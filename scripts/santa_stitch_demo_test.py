"""Run with: python3 -m unittest discover -s scripts -p 'santa_stitch_demo_test.py'."""
import io
from pathlib import Path
import tempfile
import unittest
import zipfile

from santa_stitch_demo import audio_members, extract_audio, scaled, ordered, floats


class DemoTests(unittest.TestCase):
    def archive(self, names):
        data = io.BytesIO()
        with zipfile.ZipFile(data, "w") as archive:
            for name in names:
                archive.writestr(name, b"audio")
        data.seek(0)
        return zipfile.ZipFile(data)

    def test_unsafe_paths_rejected_even_on_metadata(self):
        for name in ["../bad.wav", "/bad.wav", "test stitch/../bad.wav",
                     "test stitch\\bad.wav", "__MACOSX/../../bad"]:
            with self.subTest(name=name), self.archive([name]) as archive:
                with self.assertRaises(ValueError):
                    audio_members(archive)

    def test_metadata_ignored_and_filename_encoding_preserved(self):
        name = "test stitch/treats/pfeffernu╠êsse.wav"
        with self.archive(["__MACOSX/._bad.wav", "test stitch/.DS_Store", name]) as archive:
            members = audio_members(archive)
            self.assertEqual(len(members), 1)
            self.assertEqual(str(members[0][1]), "treats/pfeffernu╠êsse.wav")

    def test_duplicate_oversized_symlink_and_wrong_root_rejected(self):
        with self.archive(["other/test.wav"]) as archive:
            with self.assertRaises(ValueError):
                audio_members(archive)
        for kind in ["duplicate", "oversized", "symlink"]:
            with self.subTest(kind=kind), self.archive(["test stitch/1st.wav"]) as archive:
                member = archive.infolist()[0]
                if kind == "duplicate":
                    archive.filelist.append(member)
                elif kind == "oversized":
                    member.file_size = 11 * 1024**2
                else:
                    member.external_attr = 0o120777 << 16
                with self.assertRaises(ValueError):
                    audio_members(archive)

    def test_no_overwrite(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            archive = root / "test.zip"
            with zipfile.ZipFile(archive, "w") as output:
                output.writestr("test stitch/1st.wav", b"original")
            extract_audio(archive, root / "audio")
            with self.assertRaises(FileExistsError):
                extract_audio(archive, root / "audio")

    def test_gain_and_plain_concat_preserve_all_pause_samples(self):
        import array
        source = array.array("f", [0., 0., .1, -.1, 0., 0., .2, -.2, 0., 0.]).tobytes()
        result = scaled(source, -6)
        joined = result + result
        self.assertEqual(len(joined), 2 * len(source))
        for offset in [0, 1, 4, 5, 8, 9]:
            self.assertEqual(floats(result)[offset], 0.)
        self.assertEqual(joined[:len(source)], joined[len(source):])
        self.assertNotEqual(floats(result)[2], 0.)

    def test_full_script_order_and_repeated_name(self):
        self.assertEqual(ordered(["age", "activity", "achievement", "treat", "location"]),
                         ["free-intro.mp3", "@arabella", "1st.wav", "age", "2nd.wav",
                          "activity", "achievement", "3rd.wav", "treat", "4th.wav",
                          "location", "5th.wav", "@arabella", "6th.wav"])


if __name__ == "__main__":
    unittest.main()
