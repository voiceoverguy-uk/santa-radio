<?php
// Upload as workshop-index.php INSIDE names/personalised-message/.
// Read-only, PHP 5.4 compatible. Does not change the existing names-index.php.
ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
function workshop_fail($message, $status) {
    http_response_code($status);
    echo json_encode(array('error' => $message));
    exit;
}
if (!isset($_SERVER['REQUEST_METHOD']) || $_SERVER['REQUEST_METHOD'] !== 'GET') {
    header('Allow: GET');
    workshop_fail('Use GET.', 405);
}
$started = microtime(true);
$root = realpath(__DIR__);
if ($root === false) workshop_fail('Workshop folder could not be read.', 503);
// Exact existing folder names, including the original Achievment spelling.
// No query string can select a filesystem path or add another folder.
$folders = array('age' => 'AGES', 'activity' => 'Trying Hard at',
    'achievement' => 'Achievment', 'place' => 'countries', 'treat' => 'treats');
$categories = array();
$excluded = array();
foreach ($folders as $category => $folder) {
    $directory = $root . DIRECTORY_SEPARATOR . $folder;
    if (is_link($directory) || realpath($directory) !== $directory || !is_dir($directory)) {
        workshop_fail('A required workshop folder is missing or is not a regular directory.', 503);
    }
    $files = @scandir($directory);
    if ($files === false || count($files) > 10002) {
        workshop_fail('A workshop folder could not be listed safely.', 503);
    }
    $records = array();
    $skipped = 0;
    foreach ($files as $file) {
        if (microtime(true) - $started > 10) workshop_fail('Workshop scan exceeded its time limit.', 503);
        if ($file === '.' || $file === '..') continue;
        $path = $directory . DIRECTORY_SEPARATOR . $file;
        // Metadata and non-audio files are not catalogue entries.
        if (!preg_match('/\.(mp3|wav)$/iD', $file)) continue;
        if (is_link($path) || !is_file($path) || !is_readable($path) ||
            strlen($file) > 240 || substr($file, 0, 1) === '.' ||
            !preg_match('//u', $file) || preg_match('/[\/\\\\\x00-\x1f\x7f]|\p{Cf}/u', $file)) {
            $skipped++;
            continue;
        }
        $size = @filesize($path);
        if ($size === false || $size > 20 * 1024 * 1024) {
            $skipped++;
            continue;
        }
        // Preserve exact case, accents and filename bytes. Labels can be
        // formatted by the website without changing the recording identity.
        $relative = $folder . '/' . $file;
        $records[] = array('id' => 'c-' . hash('sha256', $relative),
            'file' => $relative, 'bytes' => $size);
    }
    if (count($records) === 0) workshop_fail('A required workshop folder contains no readable audio recordings.', 503);
    $categories[$category] = $records;
    $excluded[$category] = $skipped;
}
$json = json_encode(array('version' => 1, 'categories' => $categories,
    'excludedAudioCounts' => $excluded));
if ($json === false || strlen($json) > 2 * 1024 * 1024) {
    workshop_fail('Workshop inventory could not be encoded safely.', 503);
}
echo $json;
