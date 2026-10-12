<?php
// Upload this file beside the name WAVs. Standalone; no WordPress required.
// Compatible with PHP 5.4. Only regular WAV files in this folder are listed.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    header('Allow: GET');
    http_response_code(405);
    echo json_encode(array('error' => 'Use GET.'));
    exit;
}
$files = scandir(__DIR__);
if ($files === false) {
    http_response_code(503);
    echo json_encode(array('error' => 'Name folder could not be read.'));
    exit;
}
$names = array();
$seen = array();
foreach ($files as $file) {
    if (!preg_match("/^[a-zA-Z0-9][a-zA-Z0-9'_-]{0,79}\\.wav$/i", $file)) continue;
    $path = __DIR__ . DIRECTORY_SEPARATOR . $file;
    if (is_link($path) || !is_file($path) || !is_readable($path)) continue;
    $stem = substr($file, 0, -4);
    $id = strtolower(str_replace('_', '-', $stem));
    if (isset($seen[$id])) {
        http_response_code(503);
        echo json_encode(array('error' => 'Duplicate name identifiers. Check filenames.'));
        exit;
    }
    $seen[$id] = true;
    $name = ucwords(str_replace(array('-', '_'), ' ', $stem));
    $names[] = array('id' => $id, 'name' => $name, 'file' => $file);
}
echo json_encode(array('version' => 1, 'names' => $names));
