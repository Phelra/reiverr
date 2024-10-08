import { writable, get } from 'svelte/store';
import { reiverrApi, type RequestDto } from '../apis/reiverr/reiverr-api';
import { user } from './user.store';

export function createUserRequestStore() {
  const userRequests = writable<RequestDto[]>([]);

  console.log('Store initialized for user requests.');

  async function fetchUserRequests() {
    const currentUser = get(user);
    if (!currentUser) {
      console.log('No user found. Clearing requests.');
      userRequests.set([]);
      return;
    }

    try {
      console.log(`Fetching requests for user: ${currentUser.id}`);
      const requests = await reiverrApi.getAllRequests();
      if (requests) {
        console.log(`Requests fetched for user ${currentUser.id}:`, requests);
        userRequests.set(requests);
      } else {
        console.warn(`No requests found for user ${currentUser.id}.`);
      }
    } catch (error) {
      console.error('Error fetching requests for user:', error);
    }
  }
  

  async function updateRequestStatus(requestId: number, status: 'Approved' | 'Declined') {
    try {
      const response = await reiverrApi.updateRequest(requestId, { status });
      if (response) {
        userRequests.update(requests =>
          requests.map(req =>
            req.id === requestId ? { ...req, status } : req
          )
        );
        console.log(`Request ${requestId} status updated to ${status}.`);
      } else {
        console.warn(`Failed to update request ${requestId}.`);
      }
    } catch (error) {
      console.error(`Error updating request ${requestId}:`, error);
    }
  }

  async function deleteRequest(requestId: number) {
    try {
      const response = await reiverrApi.deleteRequest(requestId);
      if (response) {
        userRequests.update(requests => requests.filter(req => req.id !== requestId));
        console.log(`Request ${requestId} successfully deleted.`);
      } else {
        console.warn(`Failed to delete request ${requestId}.`);
      }
    } catch (error) {
      console.error(`Error deleting request ${requestId}:`, error);
    }
  }

  userRequests.subscribe((requests) => {
    console.log('User requests updated:', requests);
  });

  return {
    subscribe: userRequests.subscribe,
    fetchUserRequests,   
    updateRequestStatus,
    deleteRequest
  };
}

export const requestsStore = createUserRequestStore();
