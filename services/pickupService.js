// import { API_URL, handleAPIError, handleResponse } from './utils';

// /**
//  * Fetches the list of collections from the API.
//  *
//  * @returns {Promise<Object[]>} A promise that resolves to an array of pickup objects.
//  * @throws {Error} Throws an error if the fetch operation fails.
//  */
// export const fetchCollections = async () => {
//     try {
//         const response = await fetch(`${API_URL}/pickup/`);
//         const data = await handleResponse(response);
//         return data.pickups;
//     } catch (e) {
//         handleAPIError(e);
//     }
// };

// export const fetchClassifications = async () => {
//     try {
//         const response = await fetch(`${API_URL}/pickup/?type=classified`);
//         const data = await handleResponse(response);
//         return data.pickups;
//     }
//     catch (e) {
//         handleAPIError(e);
//     }
// }

// export const fetchPickupClassification = async (id) => {
//     try {
//         const response = await fetch(`${API_URL}/classification/${id}`);
//         const data = await handleResponse(response);
//         return data;
//     } catch (e) {
//         handleAPIError(e);
//     }
// };

// /**
//  * Fetches the list of pickups and updates the state with the data.
//  *
//  * @param {Function} setPickups - A function to update the state with the list of pickups.
//  * @returns {Promise<void>} A promise that resolves when the operation is complete.
//  * @throws {Error} Throws an error if the fetch operation fails.
//  */
// export const fetchPickup = async (setPickups) => {
//     try {
//         const pickups = await fetchCollections();
//         setPickups(pickups);
//     } catch (e) {
//         handleAPIError(e);
//     }
// };

// /**
//  * Sends a new pickup payload to the API to create a new pickup.
//  *
//  * @param {Object} payload - The data to be sent in the body of the POST request.
//  * @returns {Promise<Object>} A promise that resolves to the created pickup object.
//  * @throws {Error} Throws an error if the POST operation fails.
//  */
// export const upsertPickups = async (payload, type = 'POST', id = null) => {
//     // Calculate the total weight of all bags
//     // const totalWeight = payload.bags.reduce((total, bag) => total + bag.weight, 0);

//     const totalWeight = payload.bags.reduce((total, bag) => {
//         // Check if bag.weight exists and is a valid number
//         const weight = parseFloat(bag.weight);

//         // If weight is NaN (e.g., bag.weight was null, undefined, or not a number), default to 0
//         if (isNaN(weight)) {
//             return total;
//         }

//         return total + weight;
//     }, 0);

//     // Optionally, to ensure it's a float with fixed decimal places
//     const formattedTotalWeight = parseFloat(totalWeight.toFixed(2));

//     const clientId = payload.client.id ? payload.client.id : payload.client;

//     // Transform each bag to rename materialId to material_id
//     const transformedBags = payload.bags.map(({ materialId, weight, ...rest }) => ({
//         material_id: materialId,
//         weight: parseFloat(weight),
//         ...rest,
//     }));

//     // Prepare the final payload with the transformed bags
//     let finalPayload = {
//         pickup: {
//             ...payload,
//             client: clientId,
//             total_weight: formattedTotalWeight,
//             bags: transformedBags, // Use the transformed bags here
//         },
//     };

//     // Remove the timeStamp property if it exists
//     delete finalPayload.pickup.timeStamp;
//     try {
//         if (type === 'POST') {
//             const response = await fetch(`${API_URL}/pickup/`, {
//                 method: 'POST',
//                 headers: {
//                     'Content-Type': 'application/json',
//                 },
//                 body: JSON.stringify(finalPayload),
//             });

//             const data = await handleResponse(response);
//             return data;
//         }
//         else if ((type === 'PATCH') && id) {           
//             const response = await fetch(`${API_URL}/pickup/${id}/`, {
//                 method: 'PATCH',
//                 headers: {
//                     'Content-Type': 'application/json',
//                 },
//                 body: JSON.stringify(finalPayload),
//             });

//             const data = await handleResponse(response);
//             return data;
//         }
//     } catch (e) {
//         handleAPIError(e);
//     }
// };

// /**
//  * Fetches the details of a specific pickup from the API.
//  *
//  * @param {string} pickupId - The ID of the pickup to fetch details for.
//  * @returns {Promise<Object>} A promise that resolves to the pickup's details as an object.
//  * @throws {Error} Throws an error if the fetch operation fails.
//  */
// export const fetchPickupDetails = async (pickupId) => {
//     try {
//         const response = await fetch(`${API_URL}/pickup/${pickupId}`);
//         return await handleResponse(response);
//     } catch (e) {
//         handleAPIError(e);
//     }
// };

// /**
//  * Updates a specific pickup's data on the server.
//  *
//  * @param {string} pickupId - The ID of the pickup to update.
//  * @param {Object} payload - The data to be sent in the body of the PATCH request.
//  * @returns {Promise<Object>} A promise that resolves to the updated pickup object.
//  * @throws {Error} Throws an error if the PATCH operation fails.
//  */
// export const classifyPickup = async (pickupId, payload) => {
//     try {
//         const finalPayload = {
//             classifications: payload.classifications.map(classification => ({
//                 pickup: pickupId,
//                 material_id: classification.materialId ? classification.materialId : classification.material_id,
//                 submaterial_id: classification.subMaterialId,
//                 weight: parseFloat(classification.weight),
//                 count: 1
//             }))
//         };

//         console.log(finalPayload);
//         const response = await fetch(`${API_URL}/classification/`, {
//             method: 'POST',
//             headers: {
//                 'Content-Type': 'application/json',
//             },
//             body: JSON.stringify(finalPayload),
//         });
//         return await handleResponse(response);
//     } catch (e) {
//         handleAPIError(e);
//     }
// };

// /**
//  * Deletes a specific pickup from the server.
//  *
//  * @param {string} pickupId - The ID of the pickup to delete.
//  * @returns {Promise<void>} A promise that resolves when the delete operation is complete.
//  * @throws {Error} Throws an error if the DELETE operation fails.
//  */
// export const deletePickup = async (pickupId) => {
//     try {
//         const response = await fetch(`${API_URL}/pickup/${pickupId}/`, {
//             method: 'DELETE',
//         });
//         return await handleResponse(response);
//     } catch (e) {
//         handleAPIError(e);
//     }
// };

// // TODO: - Add total weight to the payload
// // {"bags": [
// //     {"count": 2002, "materialId": "papel_carton", "weight": 0}, 
// //     {"count": 232, "materialId": "otros_reciclables", "weight": null}
// // ], 
// //     "client": {"avg_usability": null, "client_name": "Banco Itau", "contact_email": null, "contact_phone": null, "first_name": "0", "id": 1, "last_name": "0", "locations": [[Object]], "pickup_frequency": "Lun Mar Mié Jue Vie"}, 
// //     "location": 1, 
// //     "timeStamp": 2024-11-18T18:43:21.128Z
// // }
