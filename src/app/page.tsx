'use client';

import { AppShell } from '@/components/sydran/app-shell';
import { CartProvider } from '@/components/sydran/use-cart';
import { useRouter } from '@/components/sydran/router';
import { GalleryView } from '@/components/sydran/gallery-view';
import { ProductDetail } from '@/components/sydran/product-detail';
import { CartView } from '@/components/sydran/cart-view';
import { OrderDetail } from '@/components/sydran/order-detail';
import { DeliveryQueue } from '@/components/sydran/delivery-queue';
import { ModPanel } from '@/components/sydran/mod-panel';
import { AdminView } from '@/components/sydran/admin-view';
import { LoginView } from '@/components/sydran/login-view';
import { RequireAuth } from '@/components/sydran/require-auth';

export default function Home() {
  return (
    <CartProvider>
      <AppShell>
        <PageRouter />
      </AppShell>
    </CartProvider>
  );
}

function PageRouter() {
  const { route } = useRouter();
  switch (route.name) {
    case 'gallery':
      return <GalleryView />;
    case 'product':
      return <ProductDetail key={route.id} productCode={route.id} />;
    case 'cart':
      return <CartView />;
    case 'order':
      return <OrderDetail key={route.code} orderCode={route.code} />;
    case 'login':
      return <LoginView />;
    case 'delivery':
      return (
        <RequireAuth>
          <DeliveryQueue />
        </RequireAuth>
      );
    case 'mod':
      return (
        <RequireAuth>
          <ModPanel />
        </RequireAuth>
      );
    case 'admin':
      return (
        <RequireAuth>
          <AdminView />
        </RequireAuth>
      );
    default:
      return <GalleryView />;
  }
}
