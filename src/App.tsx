import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "sonner"
import { AuthProvider } from "@/contexts/AuthContext"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { MembersLayout } from "@/components/members/MembersLayout"
import Index from "@/pages/Index"
import NotFound from "@/pages/NotFound"
import ChatInsights from "@/pages/members/ChatInsights"
import Directory from "@/pages/members/Directory"
import Profile from "@/pages/members/Profile"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route
                path="/members"
                element={
                  <ProtectedRoute>
                    <Navigate to="/members/chat-insights" replace />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/members/chat-insights"
                element={
                  <ProtectedRoute>
                    <MembersLayout>
                      <ChatInsights />
                    </MembersLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/members/directory"
                element={
                  <ProtectedRoute>
                    <MembersLayout>
                      <Directory />
                    </MembersLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/members/profile"
                element={
                  <ProtectedRoute>
                    <MembersLayout>
                      <Profile />
                    </MembersLayout>
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  )
}

export default App
