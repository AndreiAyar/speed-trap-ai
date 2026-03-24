"""Privacy blur helpers for vehicle regions."""

# OpenCV is used for image slicing and Gaussian blur operations.
import cv2


# This function applies blur to one bounding box region.
def blur_bbox_region(frame, bbox, blur_kernel=(37, 37), plate_kernel=(61, 61)):
    # We unpack the bounding box values as integer pixel coordinates.
    x1, y1, x2, y2 = [int(v) for v in bbox]

    # We clamp coordinates to frame bounds to avoid indexing errors.
    x1 = max(0, min(x1, frame.shape[1] - 1))
    y1 = max(0, min(y1, frame.shape[0] - 1))
    x2 = max(0, min(x2, frame.shape[1] - 1))
    y2 = max(0, min(y2, frame.shape[0] - 1))

    # We skip invalid or tiny boxes to avoid empty ROI processing.
    if x2 <= x1 or y2 <= y1:
        return frame

    # We crop the region of interest from the frame.
    roi = frame[y1:y2, x1:x2]

    # We apply Gaussian blur for privacy-friendly obfuscation.
    blurred_roi = cv2.GaussianBlur(roi, blur_kernel, 0)

    # We also blur the lower-middle area more aggressively because plates often live there.
    roi_h, roi_w = roi.shape[:2]
    plate_x1 = max(0, int(roi_w * 0.24))
    plate_x2 = min(roi_w, int(roi_w * 0.76))
    plate_y1 = max(0, int(roi_h * 0.60))
    plate_y2 = min(roi_h, int(roi_h * 0.90))

    # We only run the second pass when the heuristic plate zone has visible area.
    if plate_x2 > plate_x1 and plate_y2 > plate_y1:
        plate_roi = blurred_roi[plate_y1:plate_y2, plate_x1:plate_x2]
        blurred_roi[plate_y1:plate_y2, plate_x1:plate_x2] = cv2.GaussianBlur(plate_roi, plate_kernel, 0)

    # We write blurred pixels back into the original frame.
    frame[y1:y2, x1:x2] = blurred_roi

    # We return the modified frame for chaining.
    return frame
