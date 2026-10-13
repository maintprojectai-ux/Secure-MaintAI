import React from "react";
import { DeviceDetailClient } from "./DeviceDetailClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DeviceDetailPage({ params }: PageProps) {
  const { id } = await params;

  return <DeviceDetailClient deviceId={id} />;
}

