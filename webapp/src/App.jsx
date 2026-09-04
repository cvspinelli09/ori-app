import { Routes, Route } from 'react-router-dom';
import { Home2 } from './pages/Home2';
import { Login } from './pages/Login';
import { Catalogo2 } from './pages/Catalogo2';
import { CatalogoPdf2 } from './pages/CatalogoPdf2';
import { Admin2 } from './pages/Admin2';
import { VendedorDashboard } from './pages/VendedorDashboard';
import { ProtectedRoute } from './components/ProtectedRoute';
import { MinhaConta } from './pages/MinhaConta';

function App() {
  return (
    <Routes>
    <Route path="/" element={<Home2 />} />
    <Route path="/login" element={<Login />} />
    <Route path="/catalogo" element={<Catalogo2 />} />
    <Route path="/catalogo/pdf" element={<CatalogoPdf2 />} />

    <Route
      path="/conta"
      element={
        <ProtectedRoute roles={['cliente', 'vendedor', 'admin']}>
          <MinhaConta />
        </ProtectedRoute>
      }
    />

    <Route
      path="/admin"
      element={
        <ProtectedRoute roles={['admin']}>
          <Admin2 />
        </ProtectedRoute>
      }
    />

    <Route
      path="/vendedor"
      element={
        <ProtectedRoute roles={['vendedor', 'admin']}>
          <VendedorDashboard />
        </ProtectedRoute>
      }
    />
  </Routes>
  );
}

export default App;
