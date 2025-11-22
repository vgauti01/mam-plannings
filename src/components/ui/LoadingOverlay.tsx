import "./LoadingOverlay.css";

interface Props {
  isLoading: boolean;
  message?: string;
}

export const LoadingOverlay = ({
  isLoading,
  message = "Chargement en cours...",
}: Props) => {
  if (!isLoading) return null;

  return (
    <div className="loading-overlay">
      <div className="loading-content">
        <div className="spinner"></div>
        <p>{message}</p>
      </div>
    </div>
  );
};
