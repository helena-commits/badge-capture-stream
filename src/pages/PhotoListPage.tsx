import AuthGuard from "@/components/AuthGuard";
import PhotoList from "@/components/PhotoList";

const PhotoListPage = () => {
  return (
    <AuthGuard>
      <PhotoList />
    </AuthGuard>
  );
};

export default PhotoListPage;