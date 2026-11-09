"""Check the speed formula and rejection cases without downloading a YOLO model."""

import unittest

from modules.speed_gate import TwoLineSpeedGate


class SpeedGateTests(unittest.TestCase):
    def make_gate(self, roi=None):
        # Ten meters between horizontal gates; accepted traffic moves downward.
        return TwoLineSpeedGate(
            line_a=[[0, 10], [100, 10]],
            line_b=[[0, 20], [100, 20]],
            distance_meters=10,
            direction=[0, 1],
            roi_polygon=roi or [],
        )

    def test_ten_meters_in_one_second_is_36_kmh(self):
        gate = self.make_gate()
        gate.update_track(1, (50, 5), 0)
        gate.update_track(1, (50, 15), 500)
        result = gate.update_track(1, (50, 25), 1500)
        self.assertEqual(result["crossed_a_ms"], 500)
        self.assertEqual(result["crossed_b_ms"], 1500)
        self.assertEqual(result["speed_kmh"], 36)

    def test_one_line_is_insufficient(self):
        gate = self.make_gate()
        gate.update_track(1, (50, 5), 0)
        result = gate.update_track(1, (50, 15), 500)
        self.assertIsNone(result["speed_kmh"])

    def test_opposite_flow_has_no_speed(self):
        gate = self.make_gate()
        for y, time in [(25, 0), (15, 500), (5, 1500)]:
            result = gate.update_track(1, (50, y), time)
        self.assertIsNone(result["speed_kmh"])

    def test_crossings_from_different_ids_cannot_be_combined(self):
        gate = self.make_gate()
        gate.update_track(1, (50, 5), 0)
        gate.update_track(1, (50, 15), 500)
        gate.update_track(2, (50, 15), 600)
        result = gate.update_track(2, (50, 25), 1500)
        self.assertIsNone(result["speed_kmh"])

    def test_outside_roi_is_excluded(self):
        gate = self.make_gate([[0, 0], [10, 0], [10, 30], [0, 30]])
        for y, time in [(5, 0), (15, 500), (25, 1500)]:
            result = gate.update_track(1, (50, y), time)
        self.assertFalse(result["inside_roi"])
        self.assertIsNone(result["speed_kmh"])

    def test_debounce_rejects_impossibly_close_crossings(self):
        gate = self.make_gate()
        gate.update_track(1, (50, 5), 0)
        gate.update_track(1, (50, 15), 500)
        result = gate.update_track(1, (50, 25), 550)
        self.assertIsNone(result["speed_kmh"])


if __name__ == "__main__":
    unittest.main()
