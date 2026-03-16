import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ServerProvider } from "./context/ServerContext";
import Layout from "./components/Layout";
import Dashboard from "./components/Dashboard";
import MonitorForm from "./components/MonitorForm";
import MonitorDetail from "./components/MonitorDetail";
import LoadTest from "./components/LoadTest";
import LoadTestHistory from "./components/LoadTestHistory";
import Benchmark from "./components/Benchmark";
import BenchmarkReport from "./components/BenchmarkReport";

export default function App() {
  return (
    <ServerProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/monitors/new" element={<MonitorForm />} />
            <Route path="/monitors/:id" element={<MonitorDetail />} />
            <Route path="/load-test" element={<LoadTest />} />
            <Route path="/load-test/history" element={<LoadTestHistory />} />
            <Route path="/benchmark" element={<Benchmark />} />
            <Route path="/benchmark/:id" element={<BenchmarkReport />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ServerProvider>
  );
}

