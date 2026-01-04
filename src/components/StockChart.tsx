import axios from "axios";
import HighchartsReact from "highcharts-react-official";
import Highcharts from "highcharts/highstock";
import moment from "moment";
import React, { useEffect, useState } from "react";
import { useCommon } from "store/useCommon";

// Highcharts 모듈 로드
import "highcharts/indicators/indicators";
import "highcharts/indicators/volume-by-price";

interface StockData {
  date: string;
  close: number;
}

export const StockChart: React.FC = () => {
  const [stockData, setStockData] = useState<StockData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { setLoading } = useCommon();

  // 로컬 스토리지에서 데이터 로드
  const loadLocalData = (): StockData[] => {
    try {
      const savedData = localStorage.getItem("soxlData");
      return savedData ? JSON.parse(savedData) : [];
    } catch (error) {
      console.error("로컬 스토리지 로드 오류:", error);
      return [];
    }
  };

  // 데이터 저장
  const saveLocalData = (data: StockData[]): void => {
    try {
      localStorage.setItem("soxlData", JSON.stringify(data));
    } catch (error) {
      console.error("로컬 스토리지 저장 오류:", error);
    }
  };

  // Firebase에서 데이터 가져오기
  const fetchStockData = async () => {
    try {
      setLoading(true);

      // 1. 로컬 스토리지에서 기존 데이터 로드
      const localData = loadLocalData();
      const lastDate =
        localData.length > 0 ? localData[localData.length - 1].date : null;

      // 2. Firebase에서 데이터 가져오기
      const FIREBASE_URL = process.env.REACT_APP_FIREBASE_URL;
      if (!FIREBASE_URL) {
        throw new Error("Firebase URL not configured");
      }

      // 데이터가 있을 때만 startAt 파라미터 사용
      const params: any = { orderBy: '"$key"' };
      if (lastDate) {
        // lastDate + 1일로 설정하여 중복 방지
        const nextDateStr = moment(lastDate).add(1, "day").format("YYYY-MM-DD");
        params.startAt = `"${nextDateStr}"`;
      }

      const response = await axios.get(FIREBASE_URL, { params });

      const firebaseData = response.data;

      // 3. 데이터 가공
      const newData = Object.entries(firebaseData).map(
        ([date, item]: [string, any]) => ({
          date,
          close: parseFloat(item.close)
        })
      );

      // 4. 중복 제거 및 데이터 병합
      let updatedData = [...localData];
      if (lastDate) {
        // 마지막 날짜 이후의 새 데이터만 필터링
        const newItems = newData.filter(item => item.date > lastDate);
        updatedData = [...localData, ...newItems];
      } else {
        updatedData = newData;
      }

      // 5. 데이터 저장 및 상태 업데이트
      saveLocalData(updatedData);
      setStockData(updatedData);
      setError(null);
    } catch (error) {
      console.error("데이터 가져오기 실패:", error);
      const localData = loadLocalData();
      if (localData.length > 0) {
        setStockData(localData);
        setError(
          "최신 데이터를 가져오지 못했습니다. 오프라인 모드로 실행 중입니다."
        );
      } else {
        setError("데이터를 불러올 수 없습니다. 인터넷 연결을 확인해주세요.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStockData();
  }, []);

  // Highcharts 옵션 설정
  const options: Highcharts.Options = {
    title: {
      text: "SOXL 종가 차트",
      align: "left"
    },
    subtitle: {
      text: "Firebase Realtime Database",
      align: "left"
    },
    xAxis: {
      type: "datetime",
      dateTimeLabelFormats: {
        day: "%Y-%m-%d",
        week: "%Y-%m-%d",
        month: "%Y-%m",
        year: "%Y"
      },
      title: {
        text: "날짜"
      }
    },
    yAxis: [
      {
        title: {
          text: "종가 (USD)"
        },
        height: "100%",
        lineWidth: 2,
        resize: {
          enabled: true
        }
      }
    ],
    series: [
      {
        type: "line",
        name: "SOXL 종가",
        data: stockData.map(item => ({
          x: new Date(item.date).getTime(),
          y: item.close
        })),
        tooltip: {
          valueDecimals: 2,
          pointFormat: "종가: <b>{point.y:.2f} USD</b><br/>"
        }
      }
    ],
    chart: {
      style: {
        fontFamily: "Arial, sans-serif"
      }
    },
    plotOptions: {
      line: {
        color: "#1890ff",
        lineWidth: 2,
        marker: {
          enabled: false
        }
      }
    },
    responsive: {
      rules: [
        {
          condition: {
            maxWidth: 500
          },
          chartOptions: {
            legend: {
              enabled: false
            },
            rangeSelector: {
              inputEnabled: false
            }
          }
        }
      ]
    }
  };

  if (error) {
    return (
      <div
        style={{
          padding: "20px",
          color: "#d32f2f",
          backgroundColor: "#ffebee",
          border: "1px solid #ef9a9a",
          borderRadius: "4px",
          margin: "20px"
        }}
      >
        <h3>오류 발생</h3>
        <p>{error}</p>
        <button
          onClick={fetchStockData}
          style={{
            marginTop: "10px",
            padding: "8px 16px",
            backgroundColor: "#d32f2f",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer"
          }}
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "600px" }}>
      <HighchartsReact
        highcharts={Highcharts}
        constructorType={"chart"}
        options={options}
        containerProps={{ style: { height: "100%" } }}
      />
    </div>
  );
};

export default StockChart;
