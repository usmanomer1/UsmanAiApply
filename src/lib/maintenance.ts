// Maintenance mode configuration
export const getMaintenanceConfig = () => {
  const isMaintenanceMode = import.meta.env.VITE_MAINTENANCE_MODE === 'true';
  const adminEmails = (import.meta.env.VITE_ADMIN_EMAILS || '').split(',').map((email: string) => email.trim()).filter(Boolean);
  const maintenanceMessage = import.meta.env.VITE_MAINTENANCE_MESSAGE || 'We\'re currently configuring our payment system. The site will be fully available soon!';
  
  return {
    isMaintenanceMode,
    adminEmails,
    maintenanceMessage
  };
};

export const isAdminEmail = (email: string): boolean => {
  const { adminEmails } = getMaintenanceConfig();
  return adminEmails.includes(email);
};

export const canAccessDuringMaintenance = (email: string): boolean => {
  const { isMaintenanceMode } = getMaintenanceConfig();
  return !isMaintenanceMode || isAdminEmail(email);
}; 