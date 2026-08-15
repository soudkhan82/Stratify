"use client";

import {
  memo,
  useEffect,
  useRef,
  useState,
} from "react";

export type ConnectGooglePlace = {
  id: string;
  name: string;
  address: string;
  country: string;
  countryCode: string;
  city: string;
  lat: number;
  lng: number;
  primaryType: string;
  types: string[];
  businessStatus: string;
  googleMapsUri: string;
  sector: string;
  category: string;
  matchedServices: string[];
  matchedQueries: string[];
  source: string;
};

type Props = {
  places: ConnectGooglePlace[];
  selectedId: string | null;
  onSelect: (
    placeId: string,
  ) => void;
};

let mapsPromise:
  | Promise<any>
  | null = null;

function loadGoogleMaps(
  apiKey: string,
) {
  if (
    typeof window ===
    "undefined"
  ) {
    return Promise.reject(
      new Error(
        "Google Maps can only load in the browser.",
      ),
    );
  }

  const existingGoogle =
    (window as any)
      .google;

  if (
    existingGoogle?.maps
  ) {
    return Promise.resolve(
      existingGoogle.maps,
    );
  }

  if (mapsPromise) {
    return mapsPromise;
  }

  mapsPromise =
    new Promise(
      (
        resolve,
        reject,
      ) => {
        const callback =
          "__stratifyGoogleMapsReady";

        (window as any)[
          callback
        ] = () => {
          const google =
            (window as any)
              .google;

          if (
            google?.maps
          ) {
            resolve(
              google.maps,
            );
          } else {
            mapsPromise =
              null;
            reject(
              new Error(
                "Google Maps loaded without the maps library.",
              ),
            );
          }

          try {
            delete (
              window as any
            )[callback];
          } catch {
            // Ignore.
          }
        };

        const stale =
          document.querySelector(
            'script[data-stratify-google-maps="1"]',
          );

        if (stale) {
          stale.remove();
        }

        const script =
          document.createElement(
            "script",
          );

        script.dataset.stratifyGoogleMaps =
          "1";
        script.async =
          true;
        script.defer =
          true;
        script.src =
          `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
            apiKey,
          )}&loading=async&callback=${callback}&v=weekly`;

        script.onerror =
          () => {
            mapsPromise =
              null;
            reject(
              new Error(
                "Unable to load Google Maps JavaScript API.",
              ),
            );
          };

        document.head.appendChild(
          script,
        );
      },
    );

  return mapsPromise;
}

function escapeHtml(
  value: unknown,
) {
  return String(
    value ?? "",
  )
    .replaceAll(
      "&",
      "&amp;",
    )
    .replaceAll(
      "<",
      "&lt;",
    )
    .replaceAll(
      ">",
      "&gt;",
    )
    .replaceAll(
      '"',
      "&quot;",
    )
    .replaceAll(
      "'",
      "&#039;",
    );
}

function GooglePlacesMap({
  places,
  selectedId,
  onSelect,
}: Props) {
  const mapNodeRef =
    useRef<HTMLDivElement | null>(
      null,
    );
  const mapRef =
    useRef<any>(
      null,
    );
  const infoRef =
    useRef<any>(
      null,
    );
  const onSelectRef =
    useRef(onSelect);
  const placesRef =
    useRef(
      new Map<
        string,
        ConnectGooglePlace
      >(),
    );
  const [
    error,
    setError,
  ] =
    useState("");
  const [
    mapReady,
    setMapReady,
  ] =
    useState(false);

  const apiKey =
    process.env
      .NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ??
    "";

  useEffect(() => {
    onSelectRef.current =
      onSelect;
  }, [onSelect]);

  useEffect(() => {
    placesRef.current =
      new Map(
        places.map(
          (place) => [
            place.id,
            place,
          ],
        ),
      );
  }, [places]);

  useEffect(() => {
    if (
      !mapNodeRef.current
    ) {
      return;
    }

    if (!apiKey) {
      setError(
        "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is missing.",
      );
      return;
    }

    let alive = true;
    let clickListener:
      | any
      | null = null;

    loadGoogleMaps(
      apiKey,
    )
      .then(() => {
        if (
          !alive ||
          !mapNodeRef.current
        ) {
          return;
        }

        const google =
          (window as any)
            .google;

        const map =
          new google.maps.Map(
            mapNodeRef.current,
            {
              center: {
                lat: 20,
                lng: 0,
              },
              zoom: 2,
              minZoom: 2,
              mapTypeControl:
                false,
              streetViewControl:
                false,
              fullscreenControl:
                true,
              clickableIcons:
                false,
              gestureHandling:
                "greedy",
            },
          );

        mapRef.current =
          map;
        setMapReady(
          true,
        );

        infoRef.current =
          new google.maps.InfoWindow();

        clickListener =
          map.data.addListener(
            "click",
            (
              event: any,
            ) => {
              const id =
                String(
                  event.feature
                    ?.getId?.() ??
                    "",
                );

              if (!id) {
                return;
              }

              onSelectRef.current(
                id,
              );
            },
          );

        setError("");
      })
      .catch(
        (
          mapError,
        ) => {
          if (alive) {
            setError(
              mapError instanceof
                Error
                ? mapError.message
                : "Unable to load Google Maps.",
            );
          }
        },
      );

    return () => {
      alive = false;

      if (
        clickListener?.remove
      ) {
        clickListener.remove();
      }

      if (
        mapRef.current
          ?.data
      ) {
        const features: any[] =
          [];

        mapRef.current.data.forEach(
          (
            feature: any,
          ) => {
            features.push(
              feature,
            );
          },
        );

        for (
          const feature of
          features
        ) {
          mapRef.current.data.remove(
            feature,
          );
        }
      }

      mapRef.current =
        null;
      infoRef.current =
        null;
    };
  }, [apiKey]);

  useEffect(() => {
    const map =
      mapRef.current;

    const google =
      (window as any)
        .google;

    if (
      !map ||
      !google?.maps
    ) {
      return;
    }

    const existingFeatures: any[] =
      [];

    map.data.forEach(
      (
        feature: any,
      ) => {
        existingFeatures.push(
          feature,
        );
      },
    );

    for (
      const feature of
      existingFeatures
    ) {
      map.data.remove(
        feature,
      );
    }

    const bounds =
      new google.maps.LatLngBounds();

    for (
      const place of
      places
    ) {
      if (
        !Number.isFinite(
          place.lat,
        ) ||
        !Number.isFinite(
          place.lng,
        )
      ) {
        continue;
      }

      const point =
        new google.maps.LatLng(
          place.lat,
          place.lng,
        );

      bounds.extend(
        point,
      );

      const feature =
        new google.maps.Data.Feature(
          {
            id:
              place.id,
            geometry:
              new google.maps.Data.Point(
                point,
              ),
            properties: {
              name:
                place.name,
              address:
                place.address,
            },
          },
        );

      map.data.add(
        feature,
      );
    }

    map.data.setStyle(
      (
        feature: any,
      ) => {
        const active =
          String(
            feature.getId(),
          ) ===
          selectedId;

        return {
          icon: {
            path:
              google.maps.SymbolPath
                .CIRCLE,
            scale:
              active
                ? 10
                : 7,
            fillColor:
              active
                ? "#111827"
                : "#2563eb",
            fillOpacity: 0.96,
            strokeColor:
              "#ffffff",
            strokeWeight:
              active
                ? 3
                : 2,
          },
        };
      },
    );

    if (
      places.length ===
      1
    ) {
      map.setCenter({
        lat:
          places[0].lat,
        lng:
          places[0].lng,
      });
      map.setZoom(12);
    } else if (
      places.length >
      1
    ) {
      map.fitBounds(
        bounds,
        55,
      );
    } else {
      map.setCenter({
        lat: 20,
        lng: 0,
      });
      map.setZoom(2);
    }
  }, [
    places,
    selectedId,
    mapReady,
  ]);

  useEffect(() => {
    const map =
      mapRef.current;
    const info =
      infoRef.current;
    const google =
      (window as any)
        .google;

    if (
      !map ||
      !info ||
      !google?.maps
    ) {
      return;
    }

    map.data.setStyle(
      (
        feature: any,
      ) => {
        const active =
          String(
            feature.getId(),
          ) ===
          selectedId;

        return {
          icon: {
            path:
              google.maps.SymbolPath
                .CIRCLE,
            scale:
              active
                ? 10
                : 7,
            fillColor:
              active
                ? "#111827"
                : "#2563eb",
            fillOpacity: 0.96,
            strokeColor:
              "#ffffff",
            strokeWeight:
              active
                ? 3
                : 2,
          },
        };
      },
    );

    if (!selectedId) {
      info.close();
      return;
    }

    const place =
      placesRef.current.get(
        selectedId,
      );

    if (!place) {
      return;
    }

    const position = {
      lat:
        place.lat,
      lng:
        place.lng,
    };

    info.setPosition(
      position,
    );
    info.setContent(
      `<div style="min-width:220px;max-width:300px;padding:2px 0;">
        <div style="font-size:14px;font-weight:800;color:#0f172a;">
          ${escapeHtml(
            place.name,
          )}
        </div>
        <div style="margin-top:5px;font-size:12px;line-height:1.45;color:#64748b;">
          ${escapeHtml(
            place.address,
          )}
        </div>
        <div style="margin-top:7px;font-size:11px;font-weight:700;color:#2563eb;">
          ${escapeHtml(
            place.matchedServices.join(
              " | ",
            ),
          )}
        </div>
      </div>`,
    );
    info.open({
      map,
      shouldFocus:
        false,
    });

    map.panTo(
      position,
    );

    if (
      map.getZoom() <
      9
    ) {
      map.setZoom(9);
    }
  }, [
    selectedId,
    mapReady,
  ]);

  return (
    <div className="relative h-full min-h-[560px] overflow-hidden rounded-[22px] bg-[#eef3f7]">
      <div
        ref={mapNodeRef}
        className="absolute inset-0 h-full w-full"
      />

      {error ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/90 p-6 backdrop-blur-[2px]">
          <div className="max-w-md rounded-2xl border border-rose-100 bg-rose-50/80 px-5 py-4 text-center shadow-sm">
            <div className="text-sm font-semibold text-rose-800">
              Google Maps could not load
            </div>

            <div className="mt-2 text-xs font-normal leading-5 text-rose-700">
              {
                error
              }
            </div>
          </div>
        </div>
      ) : null}

      {!error &&
      places.length ===
        0 ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="rounded-2xl border border-slate-200/80 bg-white/95 px-5 py-4 text-center shadow-sm backdrop-blur">
            <div className="text-sm font-semibold text-slate-800">
              Select a country to begin
            </div>

            <div className="mt-1 text-xs font-normal text-slate-500">
              Google Places results will appear here.
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default memo(
  GooglePlacesMap,
);
