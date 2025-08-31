// Mock data for testing purposes
export const mockUserData = {
  id: "1a603974-847e-4b35-be60-4bbb2715e870",
  name: "Dr. Álvaro Villena",
  email: "alvaro@moca.com",
  specialization: "Psicología Clínica",
  licenseNumber: "PSI-2024-001",
  phone: "+56920115198"
};

// Function to set mock data in localStorage
export const setMockUserData = () => {
  localStorage.setItem('userData', JSON.stringify(mockUserData));
  localStorage.setItem('accessToken', 'mock-access-token');
  localStorage.setItem('refreshToken', 'mock-refresh-token');
};

// Function to clear mock data
export const clearMockUserData = () => {
  localStorage.removeItem('userData');
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
};
