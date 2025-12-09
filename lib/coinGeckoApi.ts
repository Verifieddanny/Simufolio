const BASE_URL = "https://api.coingecko.com/api/v3";
const API_KEY_PARAM = `x_cg_demo_api_key=${process.env.COIN_GECKO_API}`;

const VS_CURRENCY = "usd";

/**
 * Fetches the price of a coin at a specific UTC date (00:00:00).
 * @param coinId The CoinGecko ID (e.g., 'bitcoin').
 * @param date The date string in YYYY-MM-DD format.
 * @returns The price as a number (USD), or null if not found.
 */

export const getHistoricalData = async (
  coinId: string,
  date: string
): Promise<number | null> => {
  const url = `${BASE_URL}/coins/${coinId}/history?date=${date}&localization=false&${API_KEY_PARAM}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      // Log the full error message from the API if available
      const errorBody = await response.json();
      console.error(
        `CoinGecko History API Error (${response.status}):`,
        errorBody
      );
      return null;
    }

    const data = await response.json();

    // The price is deeply nested: market_data.current_price.usd
    const price = data?.market_data?.current_price?.usd;

    if (typeof price === "number") {
      return price;
    }

    // If the coin exists but price data for that day is unavailable
    console.warn(
      `Historical price data for ${coinId} on ${date} not found in response.`
    );
    return null;
  } catch (error) {
    console.error("Failed to fetch historical price:", error);
    return null;
  }
};

export const getCurrentPrice = async (
  coinId: string
): Promise<number | null> => {
  const url = `${BASE_URL}/simple/price?ids=${coinId}&vs_currencies=${VS_CURRENCY}&${API_KEY_PARAM}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorBody = await response.json();
      console.error(
        `CoinGecko Simple Price API Error (${response.status}):`,
        errorBody
      );
      return null;
    }
    const data = await response.json();

    const price = data?.[coinId]?.[VS_CURRENCY];

    return typeof price === "number" ? price : null;
  } catch (error) {
    console.error("Failed to fetch current price:", error);
    return null;
  }
};

/**
 * Fetches a list of all supported coin IDs, symbols, and names.
 * This is crucial for creating the user-facing selection menus.
 * @returns An array of coin objects.
 */

interface CoinListItem {
  id: string;
  symbol: string;
  name: string;
}

export const getCoinList = async (): Promise<CoinListItem[]> => {
  const url = `${BASE_URL}/coins/list?${API_KEY_PARAM}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorBody = await response.json();
      console.error(
        `CoinGecko Coin List API Error (${response.status}):`,
        errorBody
      );
      return [];
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Failed to fetch coin list:", error);
    return [];
  }
};


/**
 * Fetches comprehensive metadata for bot display.
 */
export const getCoinMetadata = async (coinId: string) => {
  const url = `${BASE_URL}/coins/${coinId}?localization=false&${API_KEY_PARAM}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
        console.error(`Metadata API Error (${response.status})`);
        return null;
    }
    const data = await response.json();
    
    return {
        id: data.id,
        name: data.name,
        symbol: data.symbol.toUpperCase(),
        imageUrl: data.image.small, 
        currentPrice: data.market_data.current_price.usd,
        marketRank: data.market_data.market_cap_rank,
    };
    
  } catch (error) {
    console.error("Failed to fetch coin metadata:", error);
    return null;
  }
}