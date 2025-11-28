require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// CWA API 設定
const CWA_API_BASE_URL = "https://opendata.cwa.gov.tw/api";
const CWA_API_KEY = process.env.CWA_API_KEY;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * 取得「全台 22 縣市」今明 36 小時天氣預報
 * 資料集：F-C0032-001
 */
const getTaiwan36hWeather = async (req, res) => {
  try {
    // 1. 檢查是否有設定 API Key
    if (!CWA_API_KEY) {
      return res.status(500).json({
        error: "伺服器設定錯誤",
        message: "請在 .env 檔案中設定 CWA_API_KEY",
      });
    }

    // 2. 呼叫 CWA API（不帶 locationName → 全台 22 縣市）
    const response = await axios.get(
      `${CWA_API_BASE_URL}/v1/rest/datastore/F-C0032-001`,
      {
        params: {
          Authorization: CWA_API_KEY,
        },
      }
    );

    const locations = response.data.records.location; // 陣列：每一筆是一個縣市

    if (!locations || locations.length === 0) {
      return res.status(404).json({
        error: "查無資料",
        message: "無法取得天氣資料",
      });
    }

    // 3. 對每一個縣市做整理
    const allWeatherData = locations.map((locationData) => {
      const weatherData = {
        city: locationData.locationName,
        updateTime: response.data.records.datasetDescription,
        forecasts: [],
      };

      const weatherElements = locationData.weatherElement;
      const timeCount = weatherElements[0].time.length;

      for (let i = 0; i < timeCount; i++) {
        const forecast = {
          startTime: weatherElements[0].time[i].startTime,
          endTime: weatherElements[0].time[i].endTime,
          weather: "",
          rain: "",
          minTemp: "",
          maxTemp: "",
          comfort: "",
          windSpeed: "",
        };

        // 把這個時間點的各個要素塞進 forecast
        weatherElements.forEach((element) => {
          const value = element.time[i].parameter;

          switch (element.elementName) {
            case "Wx":
              forecast.weather = value.parameterName;
              break;
            case "PoP":
              forecast.rain = value.parameterName + "%";
              break;
            case "MinT":
              forecast.minTemp = value.parameterName + "°C";
              break;
            case "MaxT":
              forecast.maxTemp = value.parameterName + "°C";
              break;
            case "CI":
              forecast.comfort = value.parameterName;
              break;
            case "WS":
              forecast.windSpeed = value.parameterName;
              break;
          }
        });

        weatherData.forecasts.push(forecast);
      }

      return weatherData; // 單一縣市
    });

    // 4. 把「全台」回傳給前端
    res.json({
      success: true,
      data: allWeatherData, // ← 陣列，每一個元素就是你截圖那種結構
    });
  } catch (error) {
    console.error("取得天氣資料失敗:", error.message);

    if (error.response) {
      // API 回應錯誤
      return res.status(error.response.status).json({
        error: "CWA API 錯誤",
        message: error.response.data.message || "無法取得天氣資料",
        details: error.response.data,
      });
    }

    // 其他錯誤
    res.status(500).json({
      error: "伺服器錯誤",
      message: "無法取得天氣資料，請稍後再試",
    });
  }
};

// Routes
app.get("/", (req, res) => {
  res.json({
    message: "歡迎使用 CWA 天氣預報 API",
    endpoints: {
      taiwan36h: "/api/weather/taiwan-36h",
      health: "/api/health",
    },
  });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// 取得台灣36H天氣預報
app.get("/api/weather/taiwan-36h", getTaiwan36hWeather);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "伺服器錯誤",
    message: err.message,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "找不到此路徑",
  });
});

app.listen(PORT, () => {
  console.log(`🚀 伺服器運行已運作，PORT: ${PORT}`);
  console.log(`📍 環境: ${process.env.NODE_ENV || "development"}`);
});
