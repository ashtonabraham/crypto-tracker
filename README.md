# Crypto Price Tracker

A clean, minimal Next.js web app that tracks cryptocurrency prices in real-time.

## Supported Coins

- **Bitcoin** (BTC)
- **Ethereum** (ETH)
- **Solana** (SOL)

## Features

- **Current Price** - Live price in USD for selected coin
- **Price Changes** - 24-hour and 7-day percentage changes with color coding
- **Coin Selector** - Dropdown to switch between cryptocurrencies
- **Remember Selection** - Last viewed coin is saved and restored
- **Candlestick Chart** - Interactive chart powered by TradingView Lightweight Charts
- **Time Range Toggle** - Switch between 24-hour and 7-day views
- **Auto-Refresh** - Updates every 30 seconds automatically
- **Manual Refresh** - Refresh button for instant updates

## Tech Stack

- [Next.js 14](https://nextjs.org/) - React framework
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS
- [TradingView Lightweight Charts](https://tradingview.github.io/lightweight-charts/) - Financial charting
- [CoinGecko API](https://www.coingecko.com/en/api) - Price data (free, no API key)

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Design

- **Black background** (`#0a0a0a`) with subtle secondary tones
- **White text** with gray hierarchy
- **Blue accents** (`#3b82f6`) for interactive elements
- **JetBrains Mono** for numbers, **Outfit** for UI text
