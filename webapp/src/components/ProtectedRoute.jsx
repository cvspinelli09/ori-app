import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute({ roles, children }) {
  const { session, profile, loading } = useAuth();

  if (loading) return <p>Carregando...</p>;

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!profile) {
    return <Navigate to="/" replace />;
  }

  if (profile.ativo === false) {
    return <Navigate to="/" replace />;
  }

  if (roles && !roles.includes(profile.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}