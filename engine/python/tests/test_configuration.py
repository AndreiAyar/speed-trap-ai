"""Reject calibration settings that would give an invalid or misleading result."""
from copy import deepcopy
import unittest

from modules.configuration import validate_camera_config, validate_frame_geometry


class ConfigurationTests(unittest.TestCase):
    def setUp(self):
        self.config = {
            "line_a": [[0, 100], [639, 100]],
            "line_b": [[0, 200], [639, 200]],
            "distance_meters": 5,
            "direction": [0, 1],
        }

    def test_valid_configuration_and_frame_size(self):
        validate_camera_config(self.config)
        validate_frame_geometry(self.config, 640, 360)

    def test_distance_must_be_positive_and_finite(self):
        for value in [0, -1, True, "20", float("nan"), float("inf")]:
            with self.subTest(value=value), self.assertRaisesRegex(ValueError, "distance_meters"):
                validate_camera_config({**self.config, "distance_meters": value})

    def test_degenerate_or_missing_gate_is_rejected(self):
        for points in [None, [], [[0, 0]], [[1, 1], [1, 1]], [[0, 0], [1, float("nan")]]]:
            with self.subTest(points=points), self.assertRaisesRegex(ValueError, "line_a"):
                validate_camera_config({**self.config, "line_a": points})

    def test_camera_resolution_mismatch_is_reported(self):
        with self.assertRaisesRegex(ValueError, "Recalibrate"):
            validate_frame_geometry(self.config, 320, 180)

    def test_same_gate_and_zero_direction_are_rejected(self):
        config = deepcopy(self.config)
        config["line_b"] = list(reversed(config["line_a"]))
        with self.assertRaisesRegex(ValueError, "different gates"):
            validate_camera_config(config)
        with self.assertRaisesRegex(ValueError, "nonzero"):
            validate_camera_config({**self.config, "direction": [0, 0]})

    def test_boolean_strings_and_incomplete_roi_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "privacy_blur"):
            validate_camera_config({**self.config, "privacy_blur": "false"})
        with self.assertRaisesRegex(ValueError, "three vertices"):
            validate_camera_config({**self.config, "roi_polygon": [[0, 0], [10, 0]]})
        for roi in [None, False, 0, ""]:
            with self.subTest(roi=roi), self.assertRaisesRegex(ValueError, "roi_polygon"):
                validate_camera_config({**self.config, "roi_polygon": roi})


if __name__ == "__main__":
    unittest.main()
