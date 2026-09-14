"""
Member 1: Data Cleaning Module
Handles data type conversion, sorting, and addressing OTC Gold quirks.
"""
import pandas as pd


def clean_xau_usd_data(df: pd.DataFrame) -> pd.DataFrame:
    """
    Cleans raw XAU/USD data:
    1. Drops the 'Vol.' column (OTC Gold has no centralized volume feed).
    2. Reverses chronological order (Investing.com feeds newest first; ML requires oldest first).
    3. Strips comma formatting and casts price fields to floats.
    4. Renames 'Price' to standard 'Close'.
    5. Removes NaN values.
    """
    df_clean = df.copy()
    
    # 1. Drop 'Vol.' column
    df_clean.drop(columns=['Vol.'], inplace=True, errors='ignore')
    
    # 2. Reverse Chronological Order (Oldest -> Newest)
    df_clean = df_clean.iloc[::-1].reset_index(drop=True)
    
    # 3. Clean numeric columns (supports pandas 2.x and 3.x)
    price_cols = ['Price', 'Open', 'High', 'Low']
    for col in price_cols:
        if col in df_clean.columns:
            df_clean[col] = df_clean[col].astype(str).str.replace(',', '', regex=False).str.strip().astype(float)
            
    # Clean Change % column if present
    if 'Change %' in df_clean.columns:
        df_clean['Change %'] = df_clean['Change %'].astype(str).str.replace('%', '', regex=False).str.strip().astype(float)
            
    # 4. Standardize column naming
    if 'Price' in df_clean.columns:
        df_clean.rename(columns={'Price': 'Close'}, inplace=True)
        
    # 5. Drop empty price records
    df_clean.dropna(subset=['Close', 'High', 'Low', 'Open'], inplace=True)
    df_clean.reset_index(drop=True, inplace=True)
    
    return df_clean
