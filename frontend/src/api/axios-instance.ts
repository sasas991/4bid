import Axios, { AxiosRequestConfig } from "axios";

const isServer = typeof window === "undefined";
const BASE_URL = isServer
  ? (process.env.INTERNAL_API_URL ?? "http://backend:8000")
  : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000");

export const AXIOS_INSTANCE = Axios.create({
  baseURL: BASE_URL,
});

AXIOS_INSTANCE.interceptors.request.use((config) => {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("access_token")
      : null;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export const axiosInstance = <T>(config: AxiosRequestConfig): Promise<T> => {
  const source = Axios.CancelToken.source();

  const promise = AXIOS_INSTANCE({
    ...config,
    cancelToken: source.token,
  }).then(({ data }) => data);

  // @ts-expect-error -- cancel attached for react-query compatibility
  promise.cancel = () => source.cancel("Query was cancelled");

  return promise;
};

export default axiosInstance;
