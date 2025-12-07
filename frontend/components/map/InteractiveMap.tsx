'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Report } from '@/types/report';

interface InteractiveMapProps {
    reports: Report[];
    center?: [number, number];
    zoom?: number;
}

export default function InteractiveMap({
                                           reports,
                                           center = [21.1458, 79.0882], // Nagpur coordinates
                                           zoom = 12
                                       }: InteractiveMapProps) {
    const mapRef = useRef<L.Map | null>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!mapContainerRef.current || mapRef.current) return;

        // Initialize map
        const map = L.map(mapContainerRef.current).setView(center, zoom);

        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19,
        }).addTo(map);

        mapRef.current = map;

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (!mapRef.current) return;

        // Clear existing markers
        mapRef.current.eachLayer((layer) => {
            if (layer instanceof L.Marker) {
                mapRef.current?.removeLayer(layer);
            }
        });

        // Add markers for each report
        reports.forEach((report) => {
            const [lng, lat] = report.location.coordinates;

            // Custom marker color based on status
            const markerColor = {
                Pending: '#f59e0b',
                Acknowledged: '#3b82f6',
                In_Progress: '#8b5cf6',
                Solved: '#10b981',
                Rejected: '#ef4444',
                Reported: '#f97316',
            }[report.status];

            const markerIcon = L.divIcon({
                className: 'custom-marker',
                html: `
          <div style="
            background-color: ${markerColor};
            width: 30px;
            height: 30px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 3px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          "></div>
        `,
                iconSize: [30, 30],
                iconAnchor: [15, 30],
            });

            const marker = L.marker([lat, lng], { icon: markerIcon }).addTo(mapRef.current!);

            // Popup content
            marker.bindPopup(`
        <div class="p-2">
          <h3 class="font-bold text-sm mb-1">${report.title}</h3>
          <p class="text-xs text-gray-600 mb-2">${report.description.substring(0, 100)}...</p>
          <div class="text-xs">
            <span class="font-semibold">Status:</span> ${report.status}<br/>
            <span class="font-semibold">Category:</span> ${report.category.replace(/_/g, ' ')}<br/>
            <span class="font-semibold">Ward:</span> ${report.address.ward}
          </div>
          <a href="/reports/${report._id}" class="text-blue-600 text-xs hover:underline mt-2 inline-block">
            View Details →
          </a>
        </div>
      `);
        });

        // Fit bounds to show all markers
        if (reports.length > 0) {
            const bounds = L.latLngBounds(
                reports.map((r) => [r.location.coordinates[1], r.location.coordinates[0]])
            );
            mapRef.current.fitBounds(bounds, { padding: [50, 50] });
        }
    }, [reports]);

    return (
        <div ref={mapContainerRef} className="w-full h-full" />
    );
}