<?php
// Upload this ONE script beside the recordings. The TXT is an alternative only.
// PHP 5.4 compatible; no WordPress, optional Unicode extensions or writes.
ini_set('display_errors', '0');
$diagnose = PHP_SAPI === 'cli' && isset($argv[1]) && $argv[1] === '--diagnose';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
function fail_index($message) {
    http_response_code(503);
    echo json_encode(array('error' => $message));
    exit;
}
if (!$diagnose && (!isset($_SERVER['REQUEST_METHOD']) || $_SERVER['REQUEST_METHOD'] !== 'GET')) {
    header('Allow: GET');
    http_response_code(405);
    echo json_encode(array('error' => 'Use GET.'));
    exit;
}
$started = microtime(true);
$files = @scandir(__DIR__);
if ($files === false) fail_index('Name folder could not be read.');
if (count($files) > 100002) fail_index('Directory exceeds the 100000-entry safety limit.');
$names = array();
$seen = array();
$counts = array();
$audio = array();
$total = 0;
foreach ($files as $file) {
    if (microtime(true) - $started > 10) fail_index('Directory scan exceeded the 10-second limit.');
    if ($file === '.' || $file === '..') continue;
    $total++;
    $path = __DIR__ . DIRECTORY_SEPARATOR . $file;
    $is_audio = preg_match('/\.(mp3|wav)$/iD', $file);
    // Mutually exclusive reasons: first matching condition wins.
    $reason = 'included';
    if (is_link($path)) $reason = 'symlink';
    elseif (is_dir($path)) $reason = 'directory';
    elseif (!is_file($path)) $reason = 'not_regular_file';
    elseif (!is_readable($path)) $reason = 'unreadable';
    elseif (!$is_audio) $reason = 'non_audio_extension';
    elseif (!preg_match('//u', $file)) $reason = 'malformed_utf8';
    elseif (!preg_match("/^[\\p{L}\\p{M}0-9][\\p{L}\\p{M}0-9 '’_-]{0,79}\\.(mp3|wav)$/iuD", $file)) $reason = 'unsupported_filename';
    if (!isset($counts[$reason])) $counts[$reason] = 0;
    $counts[$reason]++;
    if ($diagnose && $is_audio) {
        $audio[] = array('file' => preg_match('//u', $file) ? $file : null,
            'filename_base64' => base64_encode($file), 'reason' => $reason,
            'has_spaces' => strpos($file, ' ') !== false,
            'legacy_included' => $reason === 'included' &&
                preg_match("/^[a-zA-Z0-9][a-zA-Z0-9'_-]{0,79}\\.(mp3|wav)$/iD", $file) === 1);
    }
    if ($reason !== 'included') continue;
    // Hash exact bytes, not a lossy spelling. Case, accents and punctuation stay distinct.
    $id = 'f-' . hash('sha256', $file);
    if (isset($seen[$id])) fail_index('Duplicate exact filename identifier; no inventory returned.');
    $seen[$id] = true;
    $names[] = array('id' => $id, 'name' => ucwords(substr($file, 0, -4)), 'file' => $file);
    if (count($names) > 20000) fail_index('Inventory exceeds 20000 recordings.');
}
// Diagnostics are CLI-only: never expose a directory listing via a query string.
$data = $diagnose ? array('version' => 1, 'directory_entries' => $total,
    'reason_precedence' => array('symlink', 'directory', 'not_regular_file', 'unreadable',
        'non_audio_extension', 'malformed_utf8', 'unsupported_filename', 'included'),
    'counts' => $counts, 'audio_entries' => $audio) : array('version' => 2, 'names' => $names);
$json = json_encode($data);
if ($json === false) fail_index('Malformed UTF-8 or JSON encoding error.');
if (strlen($json) > ($diagnose ? 16 : 2) * 1024 * 1024) fail_index('Output exceeds size limit.');
echo $json;
