import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import RetailLayout from "./pages/retail/RetailLayout";
import RetailHome from "./pages/retail/RetailHome";
import RetailShop from "./pages/retail/RetailShop";
import RetailProduct from "./pages/retail/RetailProduct";
import RestaurantLayout from "./pages/restaurant/RestaurantLayout";
import RestaurantHome from "./pages/restaurant/RestaurantHome";
import RestaurantMenu from "./pages/restaurant/RestaurantMenu";
import RestaurantReserve from "./pages/restaurant/RestaurantReserve";
import HospitalLayout from "./pages/hospital/HospitalLayout";
import HospitalHome from "./pages/hospital/HospitalHome";
import HospitalServices from "./pages/hospital/HospitalServices";
import HospitalBook from "./pages/hospital/HospitalBook";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/retail" element={<RetailLayout />}>
            <Route index element={<RetailHome />} />
            <Route path="shop" element={<RetailShop />} />
            <Route path="product/:id" element={<RetailProduct />} />
          </Route>
          <Route path="/restaurant" element={<RestaurantLayout />}>
            <Route index element={<RestaurantHome />} />
            <Route path="menu" element={<RestaurantMenu />} />
            <Route path="reserve" element={<RestaurantReserve />} />
          </Route>
          <Route path="/hospital" element={<HospitalLayout />}>
            <Route index element={<HospitalHome />} />
            <Route path="services" element={<HospitalServices />} />
            <Route path="book" element={<HospitalBook />} />
          </Route>
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
