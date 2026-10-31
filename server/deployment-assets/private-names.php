<?php
// Install outside the recording directory. Configure these values in the
// origin host's private PHP/FPM environment, never in web-readable source.
ini_set('display_errors', '0');
header('Cache-Control: private, no-store, max-age=0');
header('CDN-Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
function deny_name_access($code) {
    http_response_code($code);
    header('Content-Type: application/json');
    echo '{"error":"Recording access unavailable."}';
    exit;
}
$expected = getenv('SANTA_LIBRARY_READ_TOKEN');
$provided = isset($_SERVER['HTTP_AUTHORIZATION']) ? $_SERVER['HTTP_AUTHORIZATION'] : '';
if (!$expected || strlen($expected) < 32 || !function_exists('hash_equals') ||
    !hash_equals('Bearer ' . $expected, $provided)) deny_name_access(403);
if (!isset($_SERVER['REQUEST_METHOD']) || $_SERVER['REQUEST_METHOD'] !== 'GET') deny_name_access(405);
$root = realpath(getenv('SANTA_LIBRARY_PRIVATE_DIRECTORY'));
if (!$root || !is_dir($root) || !is_readable($root)) deny_name_access(503);
$action = isset($_GET['action']) ? $_GET['action'] : '';
$pattern = "/^[\\p{L}\\p{M}0-9][\\p{L}\\p{M}0-9 '’_-]{0,79}\\.(mp3|wav)$/iuD";
if ($action === 'audio') {
    $file = isset($_GET['file']) ? $_GET['file'] : '';
    if (!preg_match($pattern, $file)) deny_name_access(400);
    $path = $root . DIRECTORY_SEPARATOR . $file;
    if (is_link($path) || !is_file($path) || !is_readable($path) ||
        filesize($path) < 1 || filesize($path) > 10 * 1024 * 1024) deny_name_access(404);
    header('Content-Type: ' . (strtolower(substr($file, -4)) === '.wav' ? 'audio/wav' : 'audio/mpeg'));
    header('Content-Length: ' . filesize($path));
    readfile($path);
    exit;
}
if ($action !== 'index') deny_name_access(400);
$files = scandir($root);
if ($files === false || count($files) > 100002) deny_name_access(503);
$names = array();
foreach ($files as $file) {
    if (!preg_match($pattern, $file)) continue;
    $path = $root . DIRECTORY_SEPARATOR . $file;
    if (is_link($path) || !is_file($path) || !is_readable($path)) continue;
    $names[] = array('id' => 'f-' . hash('sha256', $file),
        'name' => ucwords(substr($file, 0, -4)), 'file' => $file);
    if (count($names) > 20000) deny_name_access(503);
}
$json = json_encode(array('version' => 2, 'names' => $names));
if ($json === false || strlen($json) > 2 * 1024 * 1024) deny_name_access(503);
header('Content-Type: application/json; charset=utf-8');
echo $json;
