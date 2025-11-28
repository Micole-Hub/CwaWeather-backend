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
const getTaiwan36hWeather = async (req, res) => {
  try {
    if (!CWA_API_KEY) {
      return res.status(500).json({
        error: "伺服器設定錯誤",
        message: "請在 .env 檔案中設定 CWA_API_KEY",
      });
    }

    const response = await axios.get(
      `${CWA_API_BASE_URL}/v1/rest/datastore/F-C0032-001`,
      {
        params: {
          Authorization: CWA_API_KEY,
          // 不帶 locationName → 取得全台 22 縣市
        },
      }
    );

    // 🔹 這裡不要再 [0]，要拿「整個陣列」
    const locations = response.data.records.location;

    if (!locations || locations.length === 0) {
      return res.status(404).json({
        error: "查無資料",
        message: "無法取得天氣資料",
      });
    }

    // 🔹 關鍵：對「每一個縣市」跑一次整理流程
    const allWeatherData = locations.map((locationData) => {
      // 每個 locationData 就是你以前的那個 locationData（單一縣市）
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

      // map 最後要回傳「這個縣市整理好的結果」
      return weatherData;
    });

    // 🔹 這裡的 data 就是「一個陣列」，裡面每個元素就是你截圖的那種結構
    res.json({
      success: true,
      data: allWeatherData,
    });
  } catch (error) {
    console.error("取得天氣資料失敗:", error.message);

    if (error.response) {
      return res.status(error.response.status).json({
        error: "CWA API 錯誤",
        message: error.response.data.message || "無法取得天氣資料",
        details: error.response.data,
      });
    }

    res.status(500).json({
      error: "伺服器錯誤",
      message: "無法取得天氣資料，請稍後再試",
    });
  }
};

