import { supabase } from './supabase';

export function formatOrderNumberFromPlateAndSeq(plate: string | undefined | null, seq: number): string {
  const cleanPlate = plate ? plate.toLowerCase().replace(/[^a-z0-9]/g, '') : 'serv';
  const paddedSeq = String(seq).padStart(2, '0');
  return `${cleanPlate}-${paddedSeq}`;
}

export function computeOrderNumbers<
  T extends { id: string; order_date?: string; vehicles?: { plate: string } | null }
>(orders: T[]): Map<string, string> {
  const map = new Map<string, string>();

  // Group by clean plate
  const byVehicle = new Map<string, T[]>();
  for (const order of orders) {
    const plateRaw = order.vehicles?.plate;
    const cleanPlate = plateRaw ? plateRaw.toLowerCase().replace(/[^a-z0-9]/g, '') : 'serv';
    if (!byVehicle.has(cleanPlate)) {
      byVehicle.set(cleanPlate, []);
    }
    byVehicle.get(cleanPlate)!.push(order);
  }

  // Sort each vehicle's orders chronologically (oldest first: 01, 02, 03...)
  byVehicle.forEach((vOrders, cleanPlate) => {
    vOrders.sort((a, b) => {
      const timeA = a.order_date ? new Date(a.order_date).getTime() : 0;
      const timeB = b.order_date ? new Date(b.order_date).getTime() : 0;
      if (timeA !== timeB) return timeA - timeB;
      return a.id.localeCompare(b.id);
    });

    vOrders.forEach((order, index) => {
      const seq = String(index + 1).padStart(2, '0');
      map.set(order.id, `${cleanPlate}-${seq}`);
    });
  });

  return map;
}

export async function getSingleOrderNumber(orderId: string, vehicleId: string, plate: string): Promise<string> {
  try {
    const { data } = await supabase
      .from('service_orders')
      .select('id, order_date')
      .eq('vehicle_id', vehicleId);
    if (!data || data.length === 0) {
      return formatOrderNumberFromPlateAndSeq(plate, 1);
    }
    data.sort((a, b) => {
      const timeA = a.order_date ? new Date(a.order_date).getTime() : 0;
      const timeB = b.order_date ? new Date(b.order_date).getTime() : 0;
      if (timeA !== timeB) return timeA - timeB;
      return a.id.localeCompare(b.id);
    });
    const index = data.findIndex((o) => o.id === orderId);
    const seq = index >= 0 ? index + 1 : 1;
    return formatOrderNumberFromPlateAndSeq(plate, seq);
  } catch {
    return formatOrderNumberFromPlateAndSeq(plate, 1);
  }
}
