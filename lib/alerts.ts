// Price Alerts - Storage and Utilities

export interface PriceAlert {
  id: string;
  coinId: string;
  coinName: string;
  coinSymbol: string;
  targetPrice: number;
  condition: "above" | "below";
  createdAt: number;
  triggered?: boolean;
}

const ALERTS_STORAGE_KEY = "crypto-tracker-alerts";

// Get all alerts from localStorage
export function getAlerts(): PriceAlert[] {
  if (typeof window === "undefined") return [];
  
  try {
    const stored = localStorage.getItem(ALERTS_STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

// Save alerts to localStorage
export function saveAlerts(alerts: PriceAlert[]): void {
  if (typeof window === "undefined") return;
  
  try {
    localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(alerts));
  } catch {
    // Fail silently
  }
}

// Add a new alert
export function addAlert(alert: Omit<PriceAlert, "id" | "createdAt">): PriceAlert {
  const newAlert: PriceAlert = {
    ...alert,
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: Date.now(),
  };
  
  const alerts = getAlerts();
  alerts.push(newAlert);
  saveAlerts(alerts);
  
  return newAlert;
}

// Remove an alert
export function removeAlert(alertId: string): void {
  const alerts = getAlerts();
  const filtered = alerts.filter((a) => a.id !== alertId);
  saveAlerts(filtered);
}

// Mark alert as triggered
export function markAlertTriggered(alertId: string): void {
  const alerts = getAlerts();
  const updated = alerts.map((a) =>
    a.id === alertId ? { ...a, triggered: true } : a
  );
  saveAlerts(updated);
}

// Check if any alerts should fire based on current prices
export function checkAlerts(
  prices: Record<string, { price: number }>
): PriceAlert[] {
  const alerts = getAlerts();
  const triggered: PriceAlert[] = [];
  
  for (const alert of alerts) {
    if (alert.triggered) continue;
    
    const coinPrice = prices[alert.coinId]?.price;
    if (!coinPrice) continue;
    
    const shouldTrigger =
      (alert.condition === "above" && coinPrice >= alert.targetPrice) ||
      (alert.condition === "below" && coinPrice <= alert.targetPrice);
    
    if (shouldTrigger) {
      triggered.push(alert);
      markAlertTriggered(alert.id);
    }
  }
  
  return triggered;
}

// Clear all triggered alerts
export function clearTriggeredAlerts(): void {
  const alerts = getAlerts();
  const active = alerts.filter((a) => !a.triggered);
  saveAlerts(active);
}
