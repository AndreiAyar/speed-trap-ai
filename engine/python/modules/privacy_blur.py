"""Privacy blur helpers for vehicle regions."""

# OpenCV is used for image slicing and Gaussian blur operations.
import cv2


# This function applies blur to one bounding box region.
def blur_bbox_region(frame, bbox, blur_kernel=(31, 31)):
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

    # We write blurred pixels back into the original frame.
    frame[y1:y2, x1:x2] = blurred_roi

    # We return the modified frame for chaining.
    return frame
