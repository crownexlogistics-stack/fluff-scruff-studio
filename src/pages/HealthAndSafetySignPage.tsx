import { Navigate, useParams } from "react-router-dom";

const HealthAndSafetySignPage = () => {
  const { staffId } = useParams<{ staffId: string }>();
  // Redirect to unified contract signing page which handles both documents
  return <Navigate to={`/contract/sign/${staffId}`} replace />;
};

export default HealthAndSafetySignPage;
