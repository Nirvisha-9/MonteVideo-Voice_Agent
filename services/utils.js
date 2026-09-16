/**
 * The base URL for the API.
 * 
 * @type {string}
 */
export const API_URL = 'https://recyclingapi-265759442746.us-west2.run.app/api';

/**
 * Handles errors that occur during API calls.
 *
 * @param {Error} error - The error object caught during the API call.
 * @throws {Error} Throws an error with a user-friendly message.
 */
export const handleAPIError = (error) => {   
    console.error(error)
    throw new Error('Failed to perform the operation. Please try again later.');
};

/**
 * Handles the response from a fetch request.
 *
 * @param {Response} response - The response object from the fetch call.
 * @returns {Promise<Object>} Resolves to the parsed JSON response if successful.
 * @throws {Error} Throws an error if the response status is not ok, with the message from the error data or a default message.
 */
export const handleResponse = async (response) => {
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Unknown error');
    }
    return response.json();
};
