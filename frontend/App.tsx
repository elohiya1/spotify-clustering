import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import Dashboard from '@/pages/dashboard';

function App() {
  return (
    <TooltipProvider>
      <div className="dark">
        <Dashboard />
        <Toaster />
      </div>
    </TooltipProvider>
  );
}

export default App;
