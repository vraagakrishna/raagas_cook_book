import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, X } from "lucide-react";

export function ImageSourcePicker({
  onFile,
  disabled = false,
  compact = false,
}: {
  onFile: (file: File) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState("");
  const [zoom, setZoom] = useState(1);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const closeCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (preview) URL.revokeObjectURL(preview);
    setPreview("");
    setPhoto(null);
    setCameraOpen(false);
    setCameraError("");
    setZoom(1);
  };

  useEffect(() => {
    if (!cameraOpen || photo) return;
    let cancelled = false;
    void navigator.mediaDevices
      ?.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      })
      .then((stream) => {
        if (cancelled)
          return stream.getTracks().forEach((track) => track.stop());
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() =>
        setCameraError(
          "Camera access was unavailable. You can still browse for an image.",
        ),
      );
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [cameraOpen, photo]);

  const takePhoto = () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight)
      return setCameraError("Wait for the camera preview, then try again.");
    const canvas = document.createElement("canvas");
    canvas.width = Math.min(video.videoWidth, 2000);
    canvas.height = Math.round(
      canvas.width * (video.videoHeight / video.videoWidth),
    );
    const sourceWidth = video.videoWidth / zoom;
    const sourceHeight = video.videoHeight / zoom;
    canvas
      .getContext("2d")
      ?.drawImage(
        video,
        (video.videoWidth - sourceWidth) / 2,
        (video.videoHeight - sourceHeight) / 2,
        sourceWidth,
        sourceHeight,
        0,
        0,
        canvas.width,
        canvas.height,
      );
    canvas.toBlob(
      (blob) => {
        if (!blob)
          return setCameraError(
            "The photo could not be captured. Please try again.",
          );
        streamRef.current?.getTracks().forEach((track) => track.stop());
        const url = URL.createObjectURL(blob);
        setPhoto(blob);
        setPreview(url);
      },
      "image/jpeg",
      0.9,
    );
  };

  const usePhoto = () => {
    if (!photo) return;
    onFile(
      new File([photo], `camera-${Date.now()}.jpg`, { type: "image/jpeg" }),
    );
    closeCamera();
  };

  return (
    <>
      <div
        className={
          compact ? "image-upload-actions compact" : "image-upload-actions"
        }
      >
        <label className="image-picker">
          <ImagePlus size={compact ? 14 : 18} /> Browse device
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={disabled}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onFile(file);
              event.currentTarget.value = "";
            }}
          />
        </label>
        <button
          type="button"
          className="image-picker"
          disabled={disabled}
          onClick={() => setCameraOpen(true)}
        >
          <Camera size={compact ? 14 : 18} /> Take photo
        </button>
      </div>
      {cameraOpen && (
        <div className="camera-backdrop" role="presentation">
          <section
            className="camera-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Take a photo"
          >
            <button
              type="button"
              className="camera-close"
              onClick={closeCamera}
              aria-label="Close camera"
            >
              <X size={18} />
            </button>
            <h2>Take a photo</h2>
            {preview ? (
              <img src={preview} alt="Captured preview" />
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ transform: `scale(${zoom})` }}
              />
            )}
            {!preview && (
              <label className="camera-zoom">
                <span>Zoom</span>
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.1"
                  value={zoom}
                  onChange={(event) => setZoom(Number(event.target.value))}
                />
              </label>
            )}
            {cameraError && <p className="field-error">{cameraError}</p>}
            <div className="camera-actions">
              {preview ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      if (preview) URL.revokeObjectURL(preview);
                      setPreview("");
                      setPhoto(null);
                    }}
                  >
                    Take another
                  </button>
                  <button type="button" onClick={usePhoto}>
                    Use photo
                  </button>
                </>
              ) : (
                <button type="button" onClick={takePhoto}>
                  Capture photo
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
