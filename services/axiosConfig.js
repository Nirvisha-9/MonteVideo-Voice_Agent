import axios from "axios";

/**
 * Axios instance configured with a base URL and default headers.
 * 
 * @type {import('axios').AxiosInstance}
 */
const axiosInstance = axios.create({
  baseURL: 'https://express-auv3rzs3sa-uw.a.run.app/api',
  headers: {
    "Content-type": "application/json",
    'Access-Control-Allow-Origin': '*'
  }
});

export default axiosInstance;