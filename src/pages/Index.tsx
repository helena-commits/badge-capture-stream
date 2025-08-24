import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import CapturePhoto from "@/components/CapturePhoto";

const Index = () => {
  return (
    <div className="relative">
      {/* Admin access button */}
      <div className="absolute top-4 right-4 z-10">
        <Link to="/lista">
          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            Área de Gestão
          </Button>
        </Link>
      </div>
      
      {/* Main capture interface */}
      <CapturePhoto />
    </div>
  );
};

export default Index;
