import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import * as turf from "@turf/turf";
import { Box, IconButton, Button, Badge, Fab, Tooltip, Drawer, List, ListItem, ListItemText } from "@mui/material";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import { Person as UserIcon } from "@mui/icons-material";
import ReportBuilder from "./ReportBuilder";
import TuneIcon from "@mui/icons-material/Tune";
import Typography from "@mui/material/Typography";
import FormGroup from "@mui/material/FormGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import TextField from "@mui/material/TextField";
import SearchIcon from '@mui/icons-material/Search';
import CircularProgress from '@mui/material/CircularProgress';
import PropertyCartSidebar from "./PropertyCartSidebar";
import PropertyFilterSidebar from "./PropertyFilterSidebar";
import CompDashboard from "./CompDashboard";
import CompPreview from './CompPreview';
import Calendar from '@mui/icons-material/CalendarToday';
import CompReportsSidebar from './CompReportsSidebar.js';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Collapse from '@mui/material/Collapse';
import BackupTableOutlinedIcon from '@mui/icons-material/BackupTableOutlined';

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_API_KEY;

class TooltipControl {
  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'custom-tooltip-container';
    this.container.style.display = 'none';
    this.container.style.position = 'absolute';
    this.container.style.pointerEvents = 'none';
    this.container.style.zIndex = '1000';
    this.container.style.backgroundColor = 'white';
    this.container.style.padding = '8px 12px';
    this.container.style.borderRadius = '4px';
    this.container.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
    this.container.style.fontFamily = 'sans-serif';
    this.container.style.fontSize = '14px';
    this.container.style.maxWidth = '250px';
    this.container.style.transform = 'translate(-50%, -100%)';
    this.container.style.marginTop = '-10px';
  }

  onAdd(map) {
    this._map = map;
    // Append to map container instead of as a control
    this._map.getContainer().appendChild(this.container);
    return this.container;
  }

  show(content, lngLat) {
    this.container.innerHTML = content;
    this.container.style.display = 'block';
    const pos = this._map.project(lngLat);
    this.container.style.left = `${pos.x}px`;
    this.container.style.top = `${pos.y}px`;
  }

  hide() {
    this.container.style.display = 'none';
  }

  onRemove() {
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this._map = undefined;
  }
}

function usePrevious(value) {
  const ref = useRef();
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}

const MapPage = ({ user, userData, onEditProfile, refreshUserData }) => {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const activePopupRef = useRef(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectedPolygons, setSelectedPolygons] = useState(new Set());
  const hoverPopupRef = useRef(new mapboxgl.Popup({ closeButton: false, closeOnClick: false }));
  const shapeToPolygonsMap = useRef({});
  const [cartItems, setCartItems] = useState([]); // Array of site metadata
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedUseTypes, setSelectedUseTypes] = useState([]);
  const [minAcreage, setMinAcreage] = useState("");
  const [maxAcreage, setMaxAcreage] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const dmreMarkersRef = useRef([]);
  const [isSearching, setIsSearching] = useState(false);
  const tooltipControlRef = useRef(null);
  const isMobile = () => /Mobi|Android/i.test(navigator.userAgent);
  const lastTappedPolygonIdRef = useRef(null);
  const lastTapTimestampRef = useRef(0);
  const [pdfUrl, setPdfUrl] = useState(null); // 👈 Blob URL to show in iframe
  const [reportData, setReportData] = useState(null);
  const [compReports, setCompReports] = useState([]);
  const [showCompReports, setShowCompReports] = useState(false);
  const [isLoadingCompReports, setIsLoadingCompReports] = useState(false);
  const [isLoadingProperties, setIsLoadingProperties] = useState(false); // For polygons/search
  const [isLoadingReports, setIsLoadingReports] = useState(false); // For comp reports
  const isLoadingAnything = isSearching || isLoadingCompReports;
  const [hasInitialSearchCompleted, setHasInitialSearchCompleted] = useState(false);
  const [showSecondaryIcons, setShowSecondaryIcons] = useState(false);
  const [shouldShowGenerateButton, setShouldShowGenerateButton] = useState(true);
  const [reportGeoData, setReportGeoData] = useState({});
  const [orderedGeoData, setOrderedGeoData] = useState(null);
  const [reportBuilderState, setReportBuilderState] = useState(null);
  const [liveRows, setLiveRows] = useState(null); // 👈 store live, editable rows
  const [dashboardReports, setDashboardReports] = useState({
    userReports: [],
    officeReports: []
  });
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [reportEditingContext, setReportEditingContext] = useState({
    id: null,       // report_id
    status: 'draft' // current status
  });

  const officeLocations = {
    DFW: { lng: -96.82363023170578, lat: 32.95279712939538 },
    Houston: { lng: -95.3698, lat: 29.7604 },
    "Central Texas": { lng: -97.7431, lat: 30.2672 },
    Phoenix: { lng: -112.074, lat: 33.4484 },
  };

  const [navigationState, setNavigationState] = useState({
    showMap: true,
    showDashboard: false,
    showReport: false,
    showPreview: false,
    editingReport: null
  });

  const [mapViewState, setMapViewState] = useState(() => {
    // Default to DFW if no office or invalid office
    const defaultLocation = officeLocations.DFW;

    // Get user's office location if available
    const userOffice = userData?.office && officeLocations[userData.office];

    return {
      center: userOffice ? [userOffice.lng, userOffice.lat] : [defaultLocation.lng, defaultLocation.lat],
      zoom: 12
    };
  });

  // Navigation handlers
  const handleShowDashboard = () => {
    setNavigationState({
      showMap: false,
      showDashboard: true,
      showReport: false,
      showPreview: false,
      editingReport: null
    });
  };

  const handleNavigateToMap = () => {
    setNavigationState({
      showMap: true,
      showDashboard: false,
      showReport: false,
      showPreview: false,
      editingReport: null
    });
  };

  const handleEditReport = (report) => {
    // 1️⃣ Parse and store rows from the saved report into live memory
    setLiveRows(() => {
      const rawData = report.report_data;
      return Array.isArray(rawData) ? [...rawData] : JSON.parse(rawData);
    });

    // 2️⃣ Store editing context (same as before)
    setReportEditingContext({
      id: report.id,
      status: report.status
    });

    // 3️⃣ Navigate to ReportBuilder view (same as before)
    setNavigationState({
      showMap: false,
      showDashboard: false,
      showReport: true,
      showPreview: false,
      editingReport: report
    });
  };

  const handleReturnToMap = (mapData = null) => {
    // 1. First return to map view
    setNavigationState({
      showMap: true,
      showDashboard: false,
      showReport: false,
      showPreview: false,
      editingReport: null
    });

    if (mapData?.reportGeoData) {
      // 🟢 If ReportBuilder passed updated geo data, sync it here
      setReportGeoData(mapData.reportGeoData);
      console.log("🧠 Updated reportGeoData from ReportBuilder:", mapData.reportGeoData);
    }

    if (mapData) {
      // Store current cart items temporarily
      const currentCartItems = [...cartItems];
      const currentSelections = new Set(selectedPolygons);

      // 2. Fly to saved location
      if (mapData?.center?.lng !== undefined && mapData?.center?.lat !== undefined) {
        mapRef.current?.flyTo({
          center: [mapData.center.lng, mapData.center.lat],
          zoom: 12,
          essential: true
        });
      } else {
        console.warn("⚠️ No center provided in mapData. Skipping flyTo.");
      }

      // 3. Fetch with saved bounds
      const fetchWithSavedBounds = async () => {
        setIsLoadingProperties(true);
        try {
          const params = {
            minLat: mapData.bounds.minLat,
            maxLat: mapData.bounds.maxLat,
            minLng: mapData.bounds.minLng,
            maxLng: mapData.bounds.maxLng
          };

          const response = await fetch("https://tc3fvnrjqa.execute-api.us-east-1.amazonaws.com/prod/listings/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(params),
          });

          const geojson = await response.json();

          // 4. Preserve selections during render
          const selectionsToRestore = new Set([
            ...currentSelections,
            ...mapData.selectedIds
          ]);

          // 5. Modified render that preserves existing selections
          const renderAndRestore = () => {
            //console.log("%c📦 Starting renderAndRestore from saved report...", "color: #4CAF50");
            //console.log("✅ mapData.selectedIds:", mapData.selectedIds);

            renderProperties(mapRef.current, geojson, new Set());

            mapRef.current.once('idle', () => {
              //console.log("%c🗺️ Map is idle. Proceeding with cart + visual restore...", "color: #2196F3");

              // Step 3: Selected Salesforce polygons
              const selectedFeatures = geojson.features
                .filter(f => mapData.selectedIds?.includes(f.id))
                .map(f => ({
                  id: f.id,
                  properties: {
                    ...f.properties,
                    listingId: f.properties.listingId || f.id,
                    listingName: f.properties.listingName || 'Unnamed Property'
                  }
                }));

              const combinedCartItems = [
                ...currentCartItems.filter(item => !mapData.selectedIds?.includes(item.id)),
                ...selectedFeatures
              ];

              //console.log("🛒 Combined cart items:", combinedCartItems.map(i => i.id));
              setCartItems(combinedCartItems);

              const updatedSelectionSet = new Set(combinedCartItems.map(item => item.id));
              setSelectedPolygons(updatedSelectionSet);

              combinedCartItems.forEach(item => {
                const id = item.id;
                const featureExists = mapRef.current
                  .querySourceFeatures("property-polygons")
                  .some(f => f.id === id);

                if (featureExists) {
                  //console.log(`🎯 Visually selecting polygon from cart: %c${id}`, "color: #FFC107");
                  mapRef.current.setFeatureState(
                    { source: "property-polygons", id },
                    { selected: true }
                  );
                } else {
                  console.warn(`⚠️ Polygon ID not found in map source: ${id}`);
                }
              });
            });
          };

          renderAndRestore();

        } catch (err) {
          console.error("Error loading saved report:", err);
          // Fallback: Restore original state if something fails
          setCartItems(currentCartItems);
          setSelectedPolygons(currentSelections);
        } finally {
          setIsLoadingProperties(false);
        }
      };

      fetchWithSavedBounds();
    }
  };

  const handleShowPreview = (pdfUrl, reportData) => {
    setReportEditingContext(prev => ({
      ...prev,
      id: reportData.report_id || prev.id,
      status: reportData.status || prev.status
    }));
    setReportBuilderState({
      rows: reportData.currentRows,
      cartItems: reportData.currentCartItems,
      rowOrder: reportData.currentRowOrder,
      columnSettings: reportData.columnSettings,
      reportTitle: reportData.reportTitle,
      geoData: reportData.geoData,
      reportId: reportData.report_id,  // ✅ preserve ID
      reportStatus: reportData.status  // ✅ preserve status
    });
    setNavigationState(prev => ({
      ...prev,
      showPreview: true,
      showReport: false
    }));
    setPdfUrl(pdfUrl);
    setReportData(reportData);
  };

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const updateViewState = () => {
      setMapViewState({
        center: map.getCenter().toArray(),
        zoom: map.getZoom()
      });
    };

    map.on('moveend', updateViewState);

    return () => {
      map.off('moveend', updateViewState);
    };
  }, []);

  const touchStateRef = useRef({
    lastTappedId: null,
    lastTapTime: 0,
    pendingTap: null,
    tapCount: 0  // Track consecutive taps
  });

  const handlePreviewPDF = (blobUrl, reportData) => {
    setPdfUrl(blobUrl);
    setNavigationState(prev => ({
      ...prev,
      showReport: false,
      showPreview: true
    }));
    setReportData(prev => ({
      ...prev,
      ...reportData,
      user_email: userData?.user_email,
      comment: reportData.comment,
      comment_edited: false,
      report_data: reportData.report_data || [],
      geoData: reportData.geoData || {}
    }));
  };

  const handleClearAll = () => {
    const map = mapRef.current;
    if (!map) return;

    // Clear all selected polygons on the map
    cartItems.forEach(item => {
      if (map.getSource("property-polygons")) {
        map.setFeatureState(
          { source: "property-polygons", id: item.id },
          { selected: false }
        );
      }
    });

    // Clear the state
    setSelectedPolygons(new Set());
    setCartItems([]);
  };

  useEffect(() => {
    if (!navigationState.showPreview && !navigationState.showReport) {
      // When returning to map view
      const timer = setTimeout(() => {
        if (mapRef.current) {
          // Make container visible again
          mapContainer.current.style.display = 'block';

          // Force map repaint
          mapRef.current.resize();
          mapRef.current.triggerRepaint();
        }
      }, 50);

      return () => clearTimeout(timer);
    } else {
      // When going to report/preview, hide but don't destroy
      if (mapContainer.current) {
        mapContainer.current.style.display = 'none';
      }
    }
  }, [navigationState.showPreview, navigationState.showReport, mapViewState]);

  const addPolygonToSelection = (featureId) => {
    if (!featureId) return;

    const map = mapRef.current;
    if (!map || selectedPolygons.has(featureId)) return; // Already selected

    const feature = map
      .querySourceFeatures("property-polygons")
      .find((f) => f.id === featureId);

    if (feature) {
      map.setFeatureState({ source: "property-polygons", id: featureId }, { selected: true });

      setSelectedPolygons((prev) => {
        const updated = new Set(prev);
        updated.add(featureId);
        return updated;
      });

      setCartItems((prev) => {
        const alreadyInCart = prev.some((item) => item.id === featureId);
        return alreadyInCart ? prev : [...prev, feature];
      });
    }
  };

  const removeFromCart = (featureId) => {
    const map = mapRef.current;
    if (!map || !featureId) return;

    map.setFeatureState({ source: "property-polygons", id: featureId }, { selected: false });
    setSelectedPolygons(prev => {
      const updated = new Set(prev);
      updated.delete(featureId);
      return updated;
    });
    setCartItems(prev => prev.filter(item => item.id !== featureId));
  };

  const togglePolygonSelection = (featureId) => {
    if (!featureId) return;

    const map = mapRef.current;
    if (!map) return;

    // Check both the map's feature state and local state
    const isSelected =
      map.getFeatureState({ source: "property-polygons", id: featureId })?.selected ||
      selectedPolygons.has(featureId);

    if (isSelected) {
      // Deselect the polygon
      map.setFeatureState({ source: "property-polygons", id: featureId }, { selected: false });
      setSelectedPolygons(prev => {
        const updated = new Set(prev);
        updated.delete(featureId);
        return updated;
      });
      setCartItems(prev => prev.filter(item => item.id !== featureId));
    } else {
      // Select the polygon
      const feature = map
        .querySourceFeatures("property-polygons")
        .find((f) => f.id === featureId);

      if (feature) {
        map.setFeatureState({ source: "property-polygons", id: featureId }, { selected: true });
        setSelectedPolygons(prev => new Set(prev).add(featureId));
        setCartItems(prev => {
          const alreadyInCart = prev.some(item => item.id === featureId);
          return alreadyInCart ? prev : [...prev, feature];
        });
      }
    }
  };

  const addToCart = (id) => {
    if (!id) {
      console.warn("addToCart called with undefined id");
      return;
    }
    addPolygonToSelection(id)
  };

  const setLayerInteractivity = (map, interactive) => {
    const layerId = "property-polygons-layer";

    if (!map.getLayer(layerId)) return;

    // Always remove the event listener first to avoid duplicates
    map.off("click", layerId, polygonClickHandler);

    if (interactive) {
      // Add the event listener only if interactive is true
      map.on("click", layerId, polygonClickHandler);
    }
  };

  function polygonClickHandler(e) {
    const feature = e.features[0];
    const id = feature.id || feature.properties?.id;

    if (feature.properties.fillType === "blue") {
      togglePolygonSelection(id);
    }
  }

  const getTooltipContent = (feature) => {
    const props = feature.properties;
    const isBlue = props.fillType === "blue";
    console.log(props);
    let html = `<div class="custom-tooltip ${isBlue ? 'blue-tooltip' : 'grey-tooltip'}">`;

    // Common fields
    html += `<strong>${props.listingName || props.name}</strong><br/>`;

    if (isBlue) {
      // Blue polygon tooltip (comps)
      html += `
        ${props.primaryUseType ? `Use: ${props.primaryUseType}<br/>` : ''}
        ${props.acreage ? `Acreage: ${props.acreage} acres<br/>` : ''}
        ${props.leadBroker ? `Lead Broker: ${props.leadBroker}<br/>` : ''}
        ${props.commencementDate ? `Commencement Date: ${new Date(props.commencementDate).toLocaleDateString()}<br/>` : ''}
        ${props.sellerRepStatus ? `Listing Status: ${props.sellerRepStatus}<br/>` : ''}
      `;
    }
    html += `</div>`;
    return html;
  };

  const handleTouchEnd = (e) => {
    if (!isMobile()) return;
    e.preventDefault();

    const point = [e.point.x, e.point.y];
    const bbox = [[point[0] - 5, point[1] - 5], [point[0] + 5, point[1] + 5]];
    const features = mapRef.current.queryRenderedFeatures(bbox, {
      layers: ["property-polygons-layer"],
    });

    if (!features.length) {
      tooltipControlRef.current?.hide();
      touchStateRef.current = {
        lastTappedId: null,
        lastTapTime: 0,
        pendingTap: null,
        tapCount: 0
      };
      return;
    }

    const feature = features[0];
    const id = feature.id || feature.properties?.id;
    const now = Date.now();
    const state = touchStateRef.current;

    // If same polygon and within 800ms, increment tap count
    if (state.lastTappedId === id && now - state.lastTapTime < 800) {
      touchStateRef.current.tapCount++;
    } else {
      // New tap sequence
      touchStateRef.current.tapCount = 1;
    }

    // Update last tap info
    touchStateRef.current.lastTappedId = id;
    touchStateRef.current.lastTapTime = now;

    // Clear any pending single tap action
    if (state.pendingTap) {
      clearTimeout(state.pendingTap);
    }

    // Show tooltip immediately on first tap
    const coords = e.lngLat;
    const props = feature.properties;
    const tooltipHTML = getTooltipContent(feature);
    tooltipControlRef.current?.show(tooltipHTML, coords);

    // Set timeout for double-tap detection
    touchStateRef.current.pendingTap = setTimeout(() => {
      // If we get here without a second tap, it's a single tap
      if (touchStateRef.current.tapCount === 1) {
        tooltipControlRef.current?.hide();
      }
      // Reset tap count after timeout
      touchStateRef.current.tapCount = 0;
    }, 800); // Increased to 800ms for better UX

    // Check for double-tap (count of 2 or more)
    if (touchStateRef.current.tapCount >= 2) {
      //console.log("✅ DOUBLE TAP DETECTED");
      clearTimeout(touchStateRef.current.pendingTap);
      tooltipControlRef.current?.hide();

      if (feature.properties.fillType === "blue") {
        togglePolygonSelection(id);
      } else {
        window.open(`https://www.factor.dmre.com/property-detail/${id}`, "_blank");
      }

      // Reset state
      touchStateRef.current = {
        lastTappedId: null,
        lastTapTime: 0,
        pendingTap: null,
        tapCount: 0
      };
    }
  };

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleTouchStart = (e) => {
      if (!e.originalEvent.target.closest(".mapboxgl-canvas")) {
        // Only reset if we're not touching a feature
        touchStateRef.current = { lastTappedId: null, lastTapTime: 0, pendingTap: null };
        tooltipControlRef.current?.hide();
      }
    };

    map.on("touchstart", handleTouchStart);
    map.on("touchend", handleTouchEnd);

    return () => {
      map.off("touchstart", handleTouchStart);
      map.off("touchend", handleTouchEnd);
      // Clean up any pending timeouts
      if (touchStateRef.current.pendingTap) {
        clearTimeout(touchStateRef.current.pendingTap);
      }
    };
  }, [mapRef.current]);

  useEffect(() => {
    if (!mapContainer.current || !userData?.office) return;

    const officeLocation = officeLocations[userData.office];
    if (!officeLocation) return;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: mapViewState.center,
      zoom: mapViewState.zoom,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    // Force z-index after controls are added
    setTimeout(() => {
      // Navigation controls
      const navControls = document.querySelectorAll('.mapboxgl-ctrl-top-right, .mapboxgl-ctrl-group');
      navControls.forEach(ctrl => {
        ctrl.style.zIndex = '111';
      });
    }, 100);

    map.on("load", () => {
      mapRef.current = map;
      tooltipControlRef.current = new TooltipControl();
      map.getContainer().appendChild(tooltipControlRef.current.onAdd(map));

      map.on("moveend", () => {
        const center = map.getCenter();
        setMapViewState({
          center: { lng: center.lng, lat: center.lat },
          zoom: map.getZoom(),
        });
      });

      // Handle clicks on the Salesforce layer
      map.on("click", "property-polygons-layer", polygonClickHandler);

      // Handle clicks on the Salesforce layer
      map.touchZoomRotate.enable(); // Ensures touch gestures work

      map.on("touchstart", (e) => {
        // If the user touches the map without hitting a feature
        if (!e.originalEvent.target.closest(".mapboxgl-canvas")) return;

        tooltipControlRef.current?.hide();
        lastTappedPolygonIdRef.current = null;
        lastTapTimestampRef.current = 0;
      });
    });

    return () => {
      if (map) {
        // 1. Remove tooltip control if it exists
        if (tooltipControlRef.current) {
          map.removeControl(tooltipControlRef.current);
        }

        // 2. Remove existing event listeners
        map.off("click", "property-polygons-layer", polygonClickHandler);
        map.off("mousemove", "property-polygons-layer");
        map.off("mouseenter", "property-polygons-layer");
        map.off("mouseleave", "property-polygons-layer");

        // 3. Clean up any active popups
        if (hoverPopupRef.current) {
          hoverPopupRef.current.remove();
        }
        if (activePopupRef.current) {
          activePopupRef.current.remove();
        }

        // 4. Remove the map instance
        map.remove();
      }
    };
  }, [userData]);

  const getActiveFilterCount = () => {
    let count = 0;
    if (selectedUseTypes.length > 0) count++;
    if (minAcreage) count++;
    if (maxAcreage) count++;
    return count;
  };

  const handleFetchRecords = async () => {
    setIsLoadingProperties(true);
    setShowSecondaryIcons(false);

    try {
      const map = mapRef.current;
      const bounds = map.getBounds();

      const params = {
        minLat: bounds.getSouth(),
        maxLat: bounds.getNorth(),
        minLng: bounds.getWest(),
        maxLng: bounds.getEast()
      };

      // 1. Fetch properties (essential)
      const propertiesResponse = await fetch("https://tc3fvnrjqa.execute-api.us-east-1.amazonaws.com/prod/listings/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...params,
          useTypes: selectedUseTypes,
          minAcreage: minAcreage ? parseFloat(minAcreage) : undefined,
          maxAcreage: maxAcreage ? parseFloat(maxAcreage) : undefined,
        }),
      });

      // Process property data
      const geojson = await propertiesResponse.json();
      //console.log("Geojson: ", geojson);
      const savedSelections = new Set(selectedPolygons);

      // Process and render properties immediately
      renderProperties(map, geojson, savedSelections);

      // After first successful search, show the secondary icons
      if (!hasInitialSearchCompleted) {
        setHasInitialSearchCompleted(true);
      }
      setShowSecondaryIcons(true);

    } catch (err) {
      console.error("Failed to fetch records:", err);
    } finally {
      setIsLoadingProperties(false);
    }
  };

  const renderProperties = (map, geojson, savedSelections) => {
    // Remove existing DMRE markers
    dmreMarkersRef.current.forEach(marker => marker.remove());
    dmreMarkersRef.current = [];

    // Process features and add DMRE markers
    geojson.features.forEach((feature) => {
      feature.properties.interactive = true;
      feature.id = feature.properties.id;

      if (feature.properties.isDMRE) {
        const { latitude, longitude, name } = feature.properties;
        if (latitude && longitude) {
          const el = document.createElement("div");
          el.className = "dmre-marker";
          el.style.backgroundImage = "url('https://factor-mind-assets.s3.us-east-1.amazonaws.com/factor-logo-blue.png')";
          el.style.width = "28px";
          el.style.height = "28px";
          el.style.backgroundSize = "contain";
          el.style.backgroundRepeat = "no-repeat";
          el.style.backgroundPosition = "center";
          el.style.zIndex = "10";

          const marker = new mapboxgl.Marker(el)
            .setLngLat([longitude, latitude])
            .addTo(map);

          setTimeout(() => {
            if (marker._element) marker._element.style.zIndex = '10';
          }, 50);

          dmreMarkersRef.current.push(marker);
        }
      }
    });

    // Update map layers
    if (map.getLayer("property-polygons-layer")) map.removeLayer("property-polygons-layer");
    if (map.getLayer("property-borders")) map.removeLayer("property-borders");
    if (map.getSource("property-polygons")) map.removeSource("property-polygons");

    map.addSource("property-polygons", {
      type: "geojson",
      data: geojson,
      promoteId: "id",
      generateId: false,
    });

    map.addLayer({
      id: "property-polygons-layer",
      type: "fill",
      source: "property-polygons",
      paint: {
        "fill-color": [
          "case",
          ["boolean", ["feature-state", "selected"], false], "#003366",
          ["==", ["get", "fillType"], "blue"], "#00A8E8",
          ["==", ["get", "fillType"], "grey"], "#FFFFFF",
          "#000000",
        ],
        "fill-opacity": [
          "case",
          ["boolean", ["feature-state", "selected"], false], 0.85,
          ["==", ["get", "fillType"], "blue"], 0.9,
          ["==", ["get", "fillType"], "grey"], 0.3,
          0.3,
        ],
      },
    });

    map.addLayer({
      id: "property-borders",
      type: "line",
      source: "property-polygons",
      paint: {
        "line-color": [
          "case",
          ["boolean", ["feature-state", "selected"], false], "#00C4FF",
          ["==", ["get", "fillType"], "blue"], "#0077B6",
          ["==", ["get", "fillType"], "grey"], "#03FAFA",
          "#333",
        ],
        "line-width": [
          "case",
          ["boolean", ["feature-state", "selected"], false], 3,
          ["==", ["get", "fillType"], "blue"], 3,
          ["==", ["get", "fillType"], "grey"], 2,
          1,
        ],
      },
    });

    // Re-apply selection state from previous view
    savedSelections.forEach((id) => {
      map.setFeatureState({ source: "property-polygons", id }, { selected: true });
    });
    setSelectedPolygons(savedSelections); // Sync local state

    // Update event handlers
    map.off("mousemove", "property-polygons-layer");
    map.off("mouseenter", "property-polygons-layer");
    map.off("mouseleave", "property-polygons-layer");

    // Show tooltip on hover
    map.on("mousemove", "property-polygons-layer", (e) => {
      const feature = e.features[0];
      tooltipControlRef.current?.show(getTooltipContent(feature), e.lngLat);
    });

    map.on("mouseleave", "property-polygons-layer", () => {
      if (tooltipControlRef.current) {
        tooltipControlRef.current.hide();
      }
      map.getCanvas().style.cursor = "";
    });

    // Restore selections
    setSelectedPolygons((prev) => {
      const newSelections = new Set(prev);
      geojson.features.forEach((feature) => {
        const id = feature.id;
        if (newSelections.has(id)) {
          map.setFeatureState({ source: "property-polygons", id }, { selected: true });
        }
      });
      return newSelections;
    });

    console.log("Listing polygons:", geojson.features.filter(f => f.properties.fillType === "blue").length);
  };

  // Add this function to get minimal map data
  const getCartMapData = () => {
    if (!mapRef.current || cartItems.length === 0) return null;

    return {
      // Current map view (for context)
      center: mapRef.current.getCenter(),
      zoom: mapRef.current.getZoom(),

      // Only the geometries of cart items
      selectedGeometries: cartItems.map(item => ({
        id: item.id,
        type: item.geometry.type,
        coordinates: item.geometry.coordinates,
        properties: {
          name: item.properties.listingName || `Property ${item.id}`,
          // Include any other minimal properties needed
        }
      })),
    };
  };

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* Header */}
      <Box sx={{
        backgroundColor: "white",
        height: "70px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        px: 3,
        boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)",
        zIndex: 10,
        flexShrink: 0
      }}>
        <img src="/factor_listings_logo.png" alt="Factor Listings" style={{ width: "200px", height: "auto" }} />
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Tooltip title="Listing Reports Dashboard">
            <IconButton
              onClick={handleShowDashboard}
              sx={{ color: "grey" }}
            >
              <BackupTableOutlinedIcon />
            </IconButton>
          </Tooltip>
          <IconButton onClick={onEditProfile} sx={{ color: "grey" }}>
            <UserIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Main Content Area */}
      <Box sx={{
        flex: 1,
        minHeight: 0,
        position: 'relative',
        display: 'flex'
      }}>
        {/* Map Container */}
        <Box
          ref={mapContainer}
          sx={{
            flex: 1,
            display: navigationState.showReport || navigationState.showPreview ? 'none' : 'block',
            touchAction: navigationState.showDashboard ? 'none' : 'pan-x pan-y pinch-zoom',
            position: 'relative',
            width: '100%',
            height: '100%'
          }}
        />

        {/* Floating controls */}
        {!navigationState.showPreview && !navigationState.showReport && (
          <>
            {/* Top-left buttons */}
            <Box sx={{
              position: "absolute",
              top: 30,
              left: 24,
              zIndex: 1000,
              display: 'flex',
              flexDirection: 'column',
              gap: 1
            }}>
              <Tooltip title="Show Records">
                <IconButton
                  onClick={handleFetchRecords}
                  disabled={isLoadingProperties}
                  sx={{
                    backgroundColor: "white",
                    boxShadow: 3,
                    transition: 'transform 0.2s',
                    '&:hover': {
                      backgroundColor: "#f0f0f0",
                      transform: isLoadingProperties ? 'none' : 'scale(1.1)'
                    },
                  }}
                >
                  {isLoadingProperties ? (
                    <CircularProgress size={24} />
                  ) : (
                    <SearchIcon />
                  )}
                </IconButton>
              </Tooltip>

              <Tooltip title="Filter Sites">
                <Badge
                  badgeContent={getActiveFilterCount()}
                  color="primary"
                  invisible={getActiveFilterCount() === 0}
                >
                  <IconButton
                    onClick={() => setFilterOpen(true)}
                    sx={{
                      backgroundColor: "white",
                      boxShadow: 3,
                      "&:hover": { backgroundColor: "#f0f0f0" },
                    }}
                  >
                    <TuneIcon />
                  </IconButton>
                </Badge>
              </Tooltip>
            </Box>

            {/* Bottom buttons */}
            <Box
              sx={{
                position: "absolute",
                bottom: isMobile() ? 100 : 24,
                left: 0,
                right: 0,
                zIndex: 1000,
              }}
            >
              <Box sx={{
                float: "left",
                ml: 3,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 1
              }}>
                {showSecondaryIcons && (
                  <>
                    <Tooltip title="Listing Reports">
                      <Badge
                        badgeContent={isLoadingCompReports ? 0 : compReports.length}
                        color="primary"
                      >
                        <IconButton
                          onClick={() => setShowCompReports(!showCompReports)}
                          disabled={isLoadingCompReports}
                          sx={{
                            backgroundColor: "white",
                            boxShadow: 3,
                            '&:hover': {
                              backgroundColor: "#f0f0f0",
                              transform: isLoadingCompReports ? 'none' : 'scale(1.1)'
                            },
                            transition: 'all 0.2s ease'
                          }}
                        >
                          {isLoadingCompReports ? (
                            <CircularProgress size={24} color="primary" thickness={5} />
                          ) : (
                            <InsertDriveFileIcon />
                          )}
                        </IconButton>
                      </Badge>
                    </Tooltip>
                  </>
                )}
              </Box>

              <Box sx={{ float: "right", mr: 3 }}>
                <Tooltip title="View Selected Sites">
                  <IconButton
                    onClick={() => setCartOpen(true)}
                    sx={{
                      backgroundColor: "white",
                      boxShadow: 3,
                      '&:hover': { backgroundColor: "#f0f0f0" }
                    }}
                  >
                    <Badge badgeContent={cartItems.length} color="primary">
                      <ShoppingCartIcon />
                    </Badge>
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          </>
        )}
      </Box>

      {/* Sidebars */}
      <PropertyFilterSidebar
        filterOpen={filterOpen}
        setFilterOpen={setFilterOpen}
        selectedUseTypes={selectedUseTypes}
        setSelectedUseTypes={setSelectedUseTypes}
        minAcreage={minAcreage}
        setMinAcreage={setMinAcreage}
        maxAcreage={maxAcreage}
        setMaxAcreage={setMaxAcreage}
        handleApplyFilters={handleFetchRecords}
      />

      <PropertyCartSidebar
        cartOpen={cartOpen}
        setCartOpen={setCartOpen}
        cartItems={cartItems}
        togglePolygonSelection={togglePolygonSelection}
        reportGeoData={reportGeoData}
        setShowReport={() => setNavigationState(prev => ({
          ...prev,
          showReport: true,
          showMap: false
        }))}
        setCartItems={setCartItems}
        setSelectedPolygons={setSelectedPolygons}
        onClearAll={handleClearAll}
        setReportData={setReportData}
      />

      <CompReportsSidebar
        reports={compReports}
        isExpanded={showCompReports}
        toggleExpanded={() => setShowCompReports(!showCompReports)}
        isLoading={isLoadingCompReports}
        onOpenPDF={(report) => {
          window.open(report.pdf_url, '_blank');
        }}
        onLoadSession={(report) => {
          if (mapRef.current) {
            mapRef.current.flyTo({
              center: [report.report_center_lng, report.report_center_lat],
              zoom: 14,
              essential: true
            });
          }
          //console.log('Comps in this report:', report.comp_ids);
        }}
        onEditReport={(report) => {
          // Load the report into the ReportBuilder
          setNavigationState({
            showMap: false,
            showDashboard: false,
            showReport: true,
            showPreview: false,
            editingReport: report
          });
        }}
        onViewAllReports={() => {
          // Navigate to dashboard
          setNavigationState({
            showMap: false,
            showDashboard: true,
            showReport: false,
            showPreview: false,
            editingReport: null
          });
        }}
      />

      {/* Report Builder */}
      {console.log('DEBUG - reportGeoData before ReportBuilder:', reportGeoData)}
      {navigationState.showReport && (
        <ReportBuilder
          cartItems={reportBuilderState?.cartItems || cartItems}
          initialGeoData={reportBuilderState?.geoData || reportGeoData}
          setCartItems={setCartItems}
          savedReport={reportBuilderState ? null : navigationState.editingReport}
          onBack={() => handleReturnToMap()} // No data = simple return
          onReturnToMap={handleReturnToMap} // With data = full UX
          onNavigateToMap={() => handleReturnToMap()} // Simple return
          onRemoveItem={(id) => {
            setSelectedPolygons((prev) => {
              const updated = new Set(prev);
              updated.delete(id);
              return updated;
            });

            if (mapRef.current) {
              mapRef.current.setFeatureState(
                { source: "property-polygons", id },
                { selected: false }
              );
            }

            setCartItems((prev) => prev.filter((item) => item.id !== id));
          }}
          mapViewState={mapViewState}
          onPreviewPDF={handleShowPreview}
          userData={userData}
          isEditingReport={!!navigationState.editingReport}
          initialRows={reportBuilderState?.rows}
          initialRowOrder={reportBuilderState?.rowOrder}
          initialColumnSettings={reportBuilderState?.columnSettings}
          initialReportTitle={reportBuilderState?.reportTitle}
          reportId={reportEditingContext.id}
          reportStatus={reportEditingContext.status}
          onContextUpdate={(newContext) => setReportEditingContext(newContext)}
          rows={liveRows || []}                 // ✅ default to []
          setRows={setLiveRows || (() => {})}   // ✅ fallback to no-op
          reportData={reportData} 
        />
      )}

      {/* Dashboard */}
      {navigationState.showDashboard && (
        <CompDashboard
          userData={userData}
          onClose={handleReturnToMap}
          onEditReport={handleEditReport}
          navigationState={navigationState}
        />
      )}

      {/* Preview */}
      {navigationState.showPreview && (
        <CompPreview
          reportId={reportEditingContext.id}
          reportStatus={reportEditingContext.status}
          onContextUpdate={(newContext) => setReportEditingContext(newContext)}
          pdfUrl={pdfUrl}
          reportData={reportData}
          geoData={reportData.geoData}
          onBack={() => {
            if (pdfUrl) URL.revokeObjectURL(pdfUrl);
            setReportBuilderState(null);
            setNavigationState({
              ...navigationState,
              showPreview: false,
              showReport: true
            });
          }}
        />
      )}
    </Box>
  );
};

export default MapPage;
