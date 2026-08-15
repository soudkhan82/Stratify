"use client";

import {
  memo,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  CircleMarker,
  GeoJSON,
  MapContainer,
  Pane,
  Popup,
  Tooltip,
  useMap,
} from "react-leaflet";

export type ConnectMapOrganization = {
  id: string;
  name: string;
  country: string;
  city: string;
  lat: number | null;
  lng: number | null;
  services: string[];
  sectors: string[];
  website?: string | null;
  verified: boolean;
};

const WORLD_MAP_URL =
  "/maps/world-110m.min.geojson";

function BaseWorldLayer() {
  const [
    world,
    setWorld,
  ] = useState<any>(
    null,
  );

  useEffect(() => {
    let alive = true;

    fetch(
      WORLD_MAP_URL,
      {
        cache:
          "force-cache",
      },
    )
      .then(
        (
          response,
        ) => {
          if (
            !response.ok
          ) {
            throw new Error(
              `World map HTTP ${response.status}`,
            );
          }

          return response.json();
        },
      )
      .then(
        (
          data,
        ) => {
          if (alive) {
            setWorld(
              data,
            );
          }
        },
      )
      .catch(
        () => {
          // Base layer is decorative; keep directory functional.
        },
      );

    return () => {
      alive = false;
    };
  }, []);

  if (!world) {
    return null;
  }

  return (
    <GeoJSON
      data={world}
      interactive={
        false
      }
      style={{
        color:
          "#c5d1dd",
        weight: 0.6,
        fillColor:
          "#f8fafc",
        fillOpacity: 1,
      }}
    />
  );
}

function Viewport({
  organizations,
}: {
  organizations: ConnectMapOrganization[];
}) {
  const map =
    useMap();

  const points =
    useMemo(
      () =>
        organizations
          .filter(
            (
              organization,
            ) =>
              Number.isFinite(
                organization.lat,
              ) &&
              Number.isFinite(
                organization.lng,
              ),
          )
          .map(
            (
              organization,
            ) =>
              [
                Number(
                  organization.lat,
                ),
                Number(
                  organization.lng,
                ),
              ] as [
                number,
                number,
              ],
          ),
      [organizations],
    );

  useEffect(() => {
    if (
      points.length ===
      0
    ) {
      map.setView(
        [18, 5],
        1.5,
        {
          animate: false,
        },
      );
      return;
    }

    map.fitBounds(
      points,
      {
        padding: [
          45,
          45,
        ],
        maxZoom: 3,
        animate: false,
      },
    );
  }, [
    map,
    points,
  ]);

  return null;
}

function OrganizationMap({
  organizations,
}: {
  organizations: ConnectMapOrganization[];
}) {
  const valid =
    organizations.filter(
      (
        organization,
      ) =>
        Number.isFinite(
          organization.lat,
        ) &&
        Number.isFinite(
          organization.lng,
        ),
    );

  return (
    <div className="relative h-full min-h-[520px] overflow-hidden rounded-[24px] bg-[#dcecf3]">
      <MapContainer
        center={[18, 5]}
        zoom={1.5}
        minZoom={1.25}
        maxZoom={8}
        zoomSnap={0.5}
        zoomDelta={0.5}
        scrollWheelZoom
        preferCanvas
        zoomAnimation={
          false
        }
        fadeAnimation={
          false
        }
        markerZoomAnimation={
          false
        }
        inertia={false}
        attributionControl={
          false
        }
        className="h-full min-h-[520px] w-full"
        style={{
          background:
            "#dcecf3",
        }}
      >
        <Pane
          name="connect-basemap"
          style={{
            zIndex: 200,
            pointerEvents:
              "none",
          }}
        >
          <BaseWorldLayer />
        </Pane>

        <Pane
          name="connect-points"
          style={{
            zIndex: 520,
          }}
        >
          {valid.map(
            (
              organization,
            ) => (
              <CircleMarker
                key={
                  organization.id
                }
                center={[
                  Number(
                    organization.lat,
                  ),
                  Number(
                    organization.lng,
                  ),
                ]}
                radius={
                  organization.verified
                    ? 7.5
                    : 6
                }
                pathOptions={{
                  color:
                    organization.verified
                      ? "#047857"
                      : "#9a3412",
                  fillColor:
                    organization.verified
                      ? "#10b981"
                      : "#f59e0b",
                  fillOpacity: 0.9,
                  weight: 1.8,
                }}
              >
                <Tooltip
                  direction="top"
                  sticky
                  opacity={0.98}
                >
                  <div className="min-w-[180px]">
                    <div className="font-black text-slate-950">
                      {
                        organization.name
                      }
                    </div>

                    <div className="mt-1 text-xs font-semibold text-slate-500">
                      {
                        organization.city
                      }
                      {organization.city &&
                      organization.country
                        ? ", "
                        : ""}
                      {
                        organization.country
                      }
                    </div>

                    <div className="mt-1 text-[11px] font-bold text-indigo-700">
                      {organization.services
                        .slice(
                          0,
                          3,
                        )
                        .join(
                          " | ",
                        )}
                    </div>
                  </div>
                </Tooltip>

                <Popup>
                  <div className="min-w-[220px]">
                    <div className="text-[15px] font-black text-slate-950">
                      {
                        organization.name
                      }
                    </div>

                    <div className="mt-1 text-xs font-semibold text-slate-500">
                      {
                        organization.city
                      }
                      {organization.city &&
                      organization.country
                        ? ", "
                        : ""}
                      {
                        organization.country
                      }
                    </div>

                    <div className="mt-2 text-xs font-bold text-indigo-700">
                      {organization.services
                        .slice(
                          0,
                          4,
                        )
                        .join(
                          " | ",
                        )}
                    </div>

                    {organization.website ? (
                      <a
                        href={
                          organization.website
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex rounded-lg border border-indigo-500 bg-indigo-600 px-3 py-2 text-xs font-black !text-white"
                      >
                        Website
                      </a>
                    ) : null}
                  </div>
                </Popup>
              </CircleMarker>
            ),
          )}
        </Pane>

        <Viewport
          organizations={
            valid
          }
        />
      </MapContainer>

      <div className="pointer-events-none absolute bottom-3 left-3 z-[650] flex items-center gap-3 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-[9px] font-black uppercase tracking-[0.08em] text-slate-500 shadow-sm">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          Verified
        </span>

        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
          Discovered
        </span>
      </div>
    </div>
  );
}

export default memo(
  OrganizationMap,
);
