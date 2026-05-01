import {
  clearServiceOrderStorageError,
  createNextOrderCode,
  createServiceOrderId,
  getStoredOrders,
  saveStoredOrders,
  type ServiceOrder,
} from "../pages/os/osStorage";

export type {
  BudgetApprovalStatus,
  ChecklistStatus,
  ServiceOrder,
  ServiceOrderChecklistItem,
  ServiceOrderLabor,
  ServiceOrderPart,
  ServiceOrderPhoto,
  ServiceOrderPhotoType,
  ServiceOrderPhotoVisibility,
  ServiceOrderStatus,
  ServiceOrderTimelineEvent,
} from "../pages/os/osStorage";

export {
  appendServiceOrderTimelineEvent,
  BUDGET_APPROVAL_STATUSES,
  clearServiceOrderStorageError,
  createNextOrderCode,
  createServiceOrderId,
  createServiceOrderTimelineEvent,
  getBudgetApprovalBadgeClass,
  getBudgetApprovalLabel,
  getServiceOrderStatusBadgeClass,
  getServiceOrderStatusForBudgetDecision,
  getServiceOrderStatusLabel,
  getServiceOrderStorageError,
  getStoredOrders,
  isServiceOrderBudgetLocked,
  normalizeBudgetApprovalStatus,
  normalizeServiceOrderStatus,
  saveStoredOrders,
  SERVICE_ORDER_PHOTO_TYPES,
  SERVICE_ORDER_PHOTO_VISIBILITIES,
  SERVICE_ORDER_STATUSES,
  updateServiceOrderStatusWithTimeline,
} from "../pages/os/osStorage";

export function getAll() {
  return getStoredOrders();
}

export function getById(id: string) {
  return getStoredOrders().find((order) => order.id === id);
}

export function create(order: ServiceOrder) {
  saveStoredOrders([...getStoredOrders(), order]);
  clearServiceOrderStorageError();
  return order;
}

export function update(order: ServiceOrder) {
  const updatedOrders = getStoredOrders().map((currentOrder) =>
    currentOrder.id === order.id ? order : currentOrder,
  );

  saveStoredOrders(updatedOrders);
  return order;
}

export function remove(id: string) {
  const updatedOrders = getStoredOrders().filter((order) => order.id !== id);
  saveStoredOrders(updatedOrders);
  return updatedOrders;
}

export const osService = {
  getAll,
  getById,
  create,
  update,
  remove,
  createNextOrderCode,
  createServiceOrderId,
};
