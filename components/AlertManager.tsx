"use client";

import { useState, useEffect } from "react";
import { PriceAlert, getAlerts, addAlert, removeAlert, clearTriggeredAlerts } from "@/lib/alerts";
import { useNotifications } from "@/hooks/useNotifications";

interface Coin {
  id: string;
  name: string;
  symbol: string;
}

interface AlertManagerProps {
  coins: Coin[];
  selectedCoin: Coin;
  currentPrices: Record<string, { price: number }>;
}

export default function AlertManager({ coins, selectedCoin, currentPrices }: AlertManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [showForm, setShowForm] = useState(false);
  
  // Form state
  const [formCoin, setFormCoin] = useState(selectedCoin.id);
  const [formCondition, setFormCondition] = useState<"above" | "below">("above");
  const [formPrice, setFormPrice] = useState("");
  
  const { isSupported, permission, requestPermission, sendNotification } = useNotifications();

  // Load alerts on mount
  useEffect(() => {
    setAlerts(getAlerts());
  }, []);

  // Update form coin when selected coin changes
  useEffect(() => {
    setFormCoin(selectedCoin.id);
  }, [selectedCoin]);

  // Check for triggered alerts whenever prices change
  useEffect(() => {
    if (Object.keys(currentPrices).length === 0) return;
    
    const activeAlerts = alerts.filter((a) => !a.triggered);
    
    for (const alert of activeAlerts) {
      const coinPrice = currentPrices[alert.coinId]?.price;
      if (!coinPrice) continue;
      
      const shouldTrigger =
        (alert.condition === "above" && coinPrice >= alert.targetPrice) ||
        (alert.condition === "below" && coinPrice <= alert.targetPrice);
      
      if (shouldTrigger) {
        // Send notification
        const direction = alert.condition === "above" ? "above" : "below";
        sendNotification(`${alert.coinSymbol} Price Alert! 🔔`, {
          body: `${alert.coinName} is now ${direction} $${alert.targetPrice.toLocaleString()} (Current: $${coinPrice.toLocaleString()})`,
          tag: alert.id, // Prevents duplicate notifications
        });
        
        // Update local state
        setAlerts((prev) =>
          prev.map((a) => (a.id === alert.id ? { ...a, triggered: true } : a))
        );
      }
    }
  }, [currentPrices, alerts, sendNotification]);

  const handleAddAlert = () => {
    const coin = coins.find((c) => c.id === formCoin);
    if (!coin || !formPrice) return;
    
    const price = parseFloat(formPrice);
    if (isNaN(price) || price <= 0) return;
    
    const newAlert = addAlert({
      coinId: coin.id,
      coinName: coin.name,
      coinSymbol: coin.symbol,
      targetPrice: price,
      condition: formCondition,
    });
    
    setAlerts((prev) => [...prev, newAlert]);
    setFormPrice("");
    setShowForm(false);
  };

  const handleRemoveAlert = (alertId: string) => {
    removeAlert(alertId);
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
  };

  const handleClearTriggered = () => {
    clearTriggeredAlerts();
    setAlerts((prev) => prev.filter((a) => !a.triggered));
  };

  const activeAlerts = alerts.filter((a) => !a.triggered);
  const triggeredAlerts = alerts.filter((a) => a.triggered);

  const currentPrice = currentPrices[formCoin]?.price;

  return (
    <>
      {/* Alert Bell Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="relative flex items-center gap-2 px-4 py-2.5 bg-bg-tertiary border border-border rounded-lg text-sm font-medium transition-all duration-400 hover:bg-accent-blue hover:border-accent-blue"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        Alerts
        {activeAlerts.length > 0 && (
          <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-accent-blue text-white text-xs rounded-full flex items-center justify-center">
            {activeAlerts.length}
          </span>
        )}
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Modal */}
          <div className="relative bg-bg-secondary border border-border rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-lg font-semibold">Price Alerts</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-gray-500 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-5 overflow-y-auto max-h-[calc(80vh-140px)]">
              {/* Notification Permission Banner */}
              {isSupported && permission !== "granted" && (
                <div className="mb-4 p-3 bg-accent-blue/10 border border-accent-blue/30 rounded-lg">
                  <p className="text-sm text-gray-300 mb-2">
                    Enable notifications to receive price alerts.
                  </p>
                  <button
                    onClick={requestPermission}
                    className="text-sm font-medium text-accent-blue hover:underline"
                  >
                    Enable Notifications →
                  </button>
                </div>
              )}

              {!isSupported && (
                <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <p className="text-sm text-yellow-400">
                    Your browser doesn&apos;t support notifications. Alerts will only show when the app is open.
                  </p>
                </div>
              )}

              {/* Add Alert Form */}
              {showForm ? (
                <div className="mb-5 p-4 bg-bg-tertiary rounded-xl">
                  <h3 className="text-sm font-medium mb-3">New Alert</h3>
                  
                  {/* Coin Select */}
                  <div className="mb-3">
                    <label className="text-xs text-gray-500 mb-1 block">Coin</label>
                    <select
                      value={formCoin}
                      onChange={(e) => setFormCoin(e.target.value)}
                      className="w-full px-3 py-2 bg-bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:border-accent-blue"
                    >
                      {coins.map((coin) => (
                        <option key={coin.id} value={coin.id}>
                          {coin.name} ({coin.symbol})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Condition Select */}
                  <div className="mb-3">
                    <label className="text-xs text-gray-500 mb-1 block">When price goes</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setFormCondition("above")}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                          formCondition === "above"
                            ? "bg-green-500/20 text-green-400 border border-green-500/50"
                            : "bg-bg-secondary border border-border text-gray-400 hover:text-white"
                        }`}
                      >
                        ↑ Above
                      </button>
                      <button
                        onClick={() => setFormCondition("below")}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                          formCondition === "below"
                            ? "bg-red-500/20 text-red-400 border border-red-500/50"
                            : "bg-bg-secondary border border-border text-gray-400 hover:text-white"
                        }`}
                      >
                        ↓ Below
                      </button>
                    </div>
                  </div>

                  {/* Price Input */}
                  <div className="mb-4">
                    <label className="text-xs text-gray-500 mb-1 block">
                      Target Price {currentPrice && (
                        <span className="text-gray-600">(Current: ${currentPrice.toLocaleString()})</span>
                      )}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <input
                        type="number"
                        value={formPrice}
                        onChange={(e) => setFormPrice(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-7 pr-3 py-2 bg-bg-secondary border border-border rounded-lg text-sm font-mono focus:outline-none focus:border-accent-blue"
                      />
                    </div>
                  </div>

                  {/* Form Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowForm(false)}
                      className="flex-1 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddAlert}
                      disabled={!formPrice || parseFloat(formPrice) <= 0}
                      className="flex-1 py-2 bg-accent-blue text-white rounded-lg text-sm font-medium transition-all hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Create Alert
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowForm(true)}
                  className="w-full mb-5 py-3 border-2 border-dashed border-border rounded-xl text-sm text-gray-400 hover:text-white hover:border-gray-600 transition-all duration-400 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Price Alert
                </button>
              )}

              {/* Active Alerts */}
              {activeAlerts.length > 0 && (
                <div className="mb-5">
                  <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                    Active Alerts ({activeAlerts.length})
                  </h3>
                  <div className="space-y-2">
                    {activeAlerts.map((alert) => (
                      <div
                        key={alert.id}
                        className="flex items-center justify-between p-3 bg-bg-tertiary rounded-lg group"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {alert.coinSymbol}{" "}
                            <span className={alert.condition === "above" ? "text-green-400" : "text-red-400"}>
                              {alert.condition === "above" ? "↑ above" : "↓ below"}
                            </span>{" "}
                            <span className="font-mono">${alert.targetPrice.toLocaleString()}</span>
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(alert.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          onClick={() => handleRemoveAlert(alert.id)}
                          className="p-1.5 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Triggered Alerts */}
              {triggeredAlerts.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs text-gray-500 uppercase tracking-wider">
                      Triggered ({triggeredAlerts.length})
                    </h3>
                    <button
                      onClick={handleClearTriggered}
                      className="text-xs text-gray-500 hover:text-white transition-colors"
                    >
                      Clear all
                    </button>
                  </div>
                  <div className="space-y-2">
                    {triggeredAlerts.map((alert) => (
                      <div
                        key={alert.id}
                        className="flex items-center justify-between p-3 bg-bg-tertiary/50 rounded-lg opacity-60"
                      >
                        <div>
                          <p className="text-sm font-medium line-through">
                            {alert.coinSymbol}{" "}
                            {alert.condition === "above" ? "↑ above" : "↓ below"}{" "}
                            <span className="font-mono">${alert.targetPrice.toLocaleString()}</span>
                          </p>
                          <p className="text-xs text-green-500">✓ Triggered</p>
                        </div>
                        <button
                          onClick={() => handleRemoveAlert(alert.id)}
                          className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {alerts.length === 0 && !showForm && (
                <div className="text-center py-8 text-gray-500">
                  <svg className="w-12 h-12 mx-auto mb-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    />
                  </svg>
                  <p className="text-sm">No price alerts yet</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Get notified when prices hit your targets
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
