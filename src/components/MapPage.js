import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import "mapbox-gl/dist/mapbox-gl.css";
import * as turf from "@turf/turf";
import { Box, IconButton, Button, Badge, Fab, Tooltip, Drawer, List, ListItem, ListItemText } from "@mui/material";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import DeleteIcon from "@mui/icons-material/Delete";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import { Person as UserIcon } from "@mui/icons-material";
import CloseIcon from "@mui/icons-material/Close";
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
import FilterTiltShiftOutlinedIcon from '@mui/icons-material/FilterTiltShiftOutlined';
import CompPreview from './CompPreview';
import Calendar from '@mui/icons-material/CalendarToday';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import EditIcon from '@mui/icons-material/Edit';
import CompReportsSidebar from './CompReportsSidebar.js';
import InsightsIcon from '@mui/icons-material/Insights';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Collapse from '@mui/material/Collapse';
import RefreshIcon from '@mui/icons-material/Refresh';
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
  const drawRef = useRef(null);
  const markerToCircleMap = useRef({});
  const markerRadiusMap = useRef({});
  const activePopupRef = useRef(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectedPolygons, setSelectedPolygons] = useState(new Set());
  const hoverPopupRef = useRef(new mapboxgl.Popup({ closeButton: false, closeOnClick: false }));
  const popupClosedByUserRef = useRef(false);
  const lastOpenedPopupMarkerIdRef = useRef(null);
  const hasAdjustedRadiusRef = useRef({});
  const shapeToPolygonsMap = useRef({});
  const selectionSourceMap = useRef({}); // key: drawFeatureId -> Set of polygonIds
  const isDrawingRef = useRef(false);
  const justPlacedMarkerRef = useRef(false);
  const [cartItems, setCartItems] = useState([]); // Array of site metadata
  const [cartOpen, setCartOpen] = useState(false);

  const [selectedUseTypes, setSelectedUseTypes] = useState([]);
  const [minAcreage, setMinAcreage] = useState("");
  const [maxAcreage, setMaxAcreage] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const dmreMarkersRef = useRef([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showCircleRadii, setShowCircleRadii] = useState(false);
  const circleTooltips = useRef([]);
  const tooltipControlRef = useRef(null);
  const isMobile = () => /Mobi|Android/i.test(navigator.userAgent);
  //const isMobile = () => true; // 🚧 For local testing only
  const lastTappedPolygonIdRef = useRef(null);
  const lastTapTimestampRef = useRef(0);
  const [pdfUrl, setPdfUrl] = useState(null); // 👈 Blob URL to show in iframe
  const [drawnFeatures, setDrawnFeatures] = useState({ polygons: [], markers: [] });

  const [reportData, setReportData] = useState(null);
  const [compReports, setCompReports] = useState([]);
  const [showCompReports, setShowCompReports] = useState(false);
  const [isLoadingCompReports, setIsLoadingCompReports] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false); // For GPT
  const [isLoadingProperties, setIsLoadingProperties] = useState(false); // For polygons/search
  const [isLoadingReports, setIsLoadingReports] = useState(false); // For comp reports
  const [marketSummary, setMarketSummary] = useState(null);
  const [insightsExpanded, setInsightsExpanded] = useState(true);
  const [marketInsightSummary, setMarketInsightSummary] = useState("");
  const isLoadingAnything = isSearching || isLoadingCompReports;
  const [hasInitialSearchCompleted, setHasInitialSearchCompleted] = useState(false);
  const [showSecondaryIcons, setShowSecondaryIcons] = useState(false);
  const [lastInsightBounds, setLastInsightBounds] = useState(null);
  const [shouldShowGenerateButton, setShouldShowGenerateButton] = useState(true);
  const [reportGeoData, setReportGeoData] = useState({});
  const [orderedGeoData, setOrderedGeoData] = useState(null);
  const [reportBuilderState, setReportBuilderState] = useState(null);
  const [liveRows, setLiveRows] = useState(null); // 👈 store live, editable rows
  const [minCloseDate, setMinCloseDate] = useState('');
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

          const response = await fetch("https://3h3er97cni.execute-api.us-east-1.amazonaws.com/prod/comps/search", {
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
                    dealId: f.properties.dealId || f.id,
                    dealName: f.properties.dealName || 'Unnamed Property'
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
              //console.log("Marker Radii: ", mapData.marker_radii);
              //console.log("Drawn Polygons: ", mapData.drawn_polygons);
              // MARKER RESTORE
              if (mapData.marker_radii && Array.isArray(mapData.marker_radii)) {
                //console.log("%c📍 Restoring drawn markers + radii:", "color: #9C27B0");
                mapData.marker_radii.forEach(({ center, radius, markerId }) => {
                  //console.log(`➕ Drawing marker: ${markerId} | Center: ${center}, Radius: ${radius}`);

                  drawRef.current.add({
                    type: "Feature",
                    id: markerId,
                    properties: {},
                    geometry: {
                      type: "Point",
                      coordinates: center
                    }
                  });

                  drawCircle(center, radius, mapRef.current, markerId);

                  const buffered = turf.buffer(turf.point(center), radius, { units: "miles" });
                  autoSelectIntersectingPolygons(buffered.geometry, markerId);
                });
              } else {
                //console.log("%cℹ️ No markers to restore", "color: gray");
              }

              // POLYGON RESTORE
              if (mapData.drawn_polygons && Array.isArray(mapData.drawn_polygons)) {
                //console.log("%c🧩 Restoring drawn polygons:", "color: #FF5722");
                mapData.drawn_polygons.forEach((coords, i) => {
                  const polygonId = `restored-draw-${i}`;
                  //console.log(`➕ Drawing polygon ${polygonId}:`, coords);

                  const polygonFeature = {
                    type: "Feature",
                    id: polygonId,
                    properties: {},
                    geometry: {
                      type: "Polygon",
                      coordinates: [coords]
                    }
                  };

                  drawRef.current.add(polygonFeature);
                  autoSelectIntersectingPolygons(polygonFeature.geometry, polygonId);
                });
              } else {
                console.log("%cℹ️ No polygons to restore", "color: gray");
              }
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

  const toggleCircleRadii = () => {
    const map = mapRef.current;
    if (!map) return;

    if (showCircleRadii) {
      // Remove all tooltips
      circleTooltips.current.forEach(tooltip => tooltip.remove());
      circleTooltips.current = [];
    } else {
      // Create new array for tooltips
      const newTooltips = [];

      // Create tooltips for all circles
      Object.entries(markerRadiusMap.current).forEach(([markerId, radius]) => {
        const circleData = markerToCircleMap.current[markerId];
        if (circleData && map.getSource(circleData.id)) {
          const tooltip = new mapboxgl.Popup({
            closeButton: false,
            className: 'radius-tooltip' // Add a custom class
          })
            .setLngLat(circleData.center)
            .setHTML(`<div style="font-size: 12px;">Radius: ${radius.toFixed(2)} mi</div>`)
            .addTo(map);

          // Force higher z-index
          setTimeout(() => {
            const elements = document.getElementsByClassName('radius-tooltip');
            for (let el of elements) {
              el.style.zIndex = '1001'; // Higher than DMRE markers (which are at 10)
            }
          }, 50);

          newTooltips.push(tooltip);
        }
      });

      circleTooltips.current = newTooltips;
    }

    setShowCircleRadii(!showCircleRadii);
  };

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

      //console.log("🔹 Added polygon to selection:", featureId);
    }
  };

  const removeFromCart = (featureId) => {
    const map = mapRef.current;
    if (!map || !featureId) return;

    //console.log("🧹 Removing polygon from cart:", featureId);

    // Deselect on map
    map.setFeatureState({ source: "property-polygons", id: featureId }, { selected: false });

    // Remove from selection set
    setSelectedPolygons((prevSelected) => {
      const updated = new Set(prevSelected);
      updated.delete(featureId);
      return updated;
    });

    // Remove from cart
    setCartItems((prevCart) => prevCart.filter((item) => item.id !== featureId));

    // Remove from reportGeoData
    setReportGeoData((prev) => {
      const newData = { ...prev };
      delete newData[featureId];
      console.log("🗑️ Removed geo data for:", featureId);
      return newData;
    });
  };

  const togglePolygonSelection = (featureId) => {
    if (!featureId) {
      console.warn("🚨 No featureId provided to togglePolygonSelection");
      return;
    }

    const map = mapRef.current;
    const isSelected =
      map.getFeatureState({ source: "property-polygons", id: featureId })?.selected ??
      selectedPolygons.has(featureId);

    // Update the polygon state on the map and internal set
    setSelectedPolygons((prevSelected) => {
      const updated = new Set(prevSelected);

      if (isSelected) {
        //console.log("🔻 Deselecting polygon", featureId);
        //updated.delete(featureId);
        removeFromCart(featureId);
        map.setFeatureState({ source: "property-polygons", id: featureId }, { selected: false });

        // Remove from cart
        setCartItems((prev) => prev.filter((item) => item.id !== featureId));
      } else {
        //console.log("🔹 Selecting polygon", featureId);
        updated.add(featureId);
        map.setFeatureState({ source: "property-polygons", id: featureId }, { selected: true });

        // Add to cart
        const feature = map
          .querySourceFeatures("property-polygons")
          .find((f) => f.id === featureId);
          if (feature) {
            setCartItems((prev) => {
              const alreadyInCart = prev.some((item) => item.id === feature.id);
              if (!alreadyInCart) {
                return [...prev, feature];
              }
              return prev;
            });
            setReportGeoData(prev => {
              const newData = {
                ...prev,
                [featureId]: {
                  geometry: feature.geometry,
                  properties: {
                    dealName: feature.properties.dealName,
                    acreage: feature.properties.acreage
                  }
                }
              };
              console.log("🟢 Updated reportGeoData:", newData);
              return newData;
            });
          }
      }

      return updated;
    });
  };

  const autoSelectIntersectingPolygons = (drawnGeometry, drawFeatureId) => {
    const map = mapRef.current;
    if (!map) return;

    const allFeatures = map.querySourceFeatures("property-polygons");
    const selectedForThisDraw = new Set();

    allFeatures.forEach((feature) => {
      const polygonGeometry = feature.geometry;
      const intersects = turf.booleanIntersects(drawnGeometry, polygonGeometry);

      if (intersects && feature.properties.fillType === "blue") {
        const id = feature.id || feature.properties?.id;
        if (id) {
          //console.log("✅ Auto-adding polygon due to intersection:", id);
          addPolygonToSelection(id);

          setReportGeoData(prev => ({
            ...prev,
            [id]: {
              geometry: feature.geometry,
              properties: {
                dealName: feature.properties.dealName,
                acreage: feature.properties.acreage
              }
            }
          }));
          //console.log("Autoselection Geometry: ", feature.geometry);
          selectedForThisDraw.add(id);
        }
      }
    });

    // Track which polygons were selected by this shape
    if (drawFeatureId) {
      selectionSourceMap.current[drawFeatureId] = selectedForThisDraw;
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
    if (isMobile()) return; // ✅ Skip on mobile
    // 🛑 Suppress click if marker was just placed
    if (justPlacedMarkerRef.current) {
      //console.log("🛑 Click suppressed: just placed a marker.");
      return;
    }

    const drawMode = drawRef.current?.getMode?.();

    if (drawMode === "draw_point" || drawMode === "draw_polygon") {
      //console.log("🚫 Click suppressed during draw mode:", drawMode);
      return;
    }

    const feature = e.features[0];
    const id = feature.id || feature.properties?.id;

    if (feature.properties.fillType === "blue") {
      // Only add if NOT in drawing mode
      const drawMode = drawRef.current?.getMode?.();
      const isDrawing = drawMode === "draw_point" || drawMode === "draw_polygon";

      if (!isDrawing) {
        togglePolygonSelection(id); // ✅ Now toggles on click
      }
    } else {
      window.open(`https://www.factor.dmre.com/property-detail/${id}`, "_blank");
    }
  }

  const getTooltipContent = (feature) => {
    const props = feature.properties;
    const isBlue = props.fillType === "blue";

    let html = `<div class="custom-tooltip ${isBlue ? 'blue-tooltip' : 'grey-tooltip'}">`;

    // Common fields
    html += `<strong>${props.dealName || props.name}</strong><br/>`;

    if (isBlue) {
      // Blue polygon tooltip (comps)
      html += `
        ${props.primaryUseType ? `Use: ${props.primaryUseType}<br/>` : ''}
        ${props.acreage ? `Acreage: ${props.acreage} acres<br/>` : ''}
        ${props.calculatedPrice ? `Price: $${props.calculatedPrice.toLocaleString()}<br/>` : ''}
        ${props.outsideCloseDate ? `Close: ${new Date(props.outsideCloseDate).toLocaleDateString()}<br/>` : ''}
        ${props.buyer ? `Buyer: ${props.buyer}<br/>` : ''}
      `;
    } else {
      // Grey polygon tooltip (non-comps)
      html += `
        ${props.status ? `Status: ${props.status}<br/>` : ''}
        ${props.acreage ? `Acreage: ${props.acreage} acres<br/>` : ''}
        ${props.city ? `City: ${props.city}<br/>` : ''}
        ${props.currentAllowableUses ? `Current Uses: ${props.currentAllowableUses}<br/>` : ''}
        ${props.futureAllowableUses ? `Future Uses: ${props.futureAllowableUses}<br/>` : ''}
        ${props.futureSupplyUses ? `Supply Uses: ${props.futureSupplyUses}<br/>` : ''}
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

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: { point: true, polygon: true, trash: true },
    });

    map.addControl(draw);

    // Force z-index after controls are added
    setTimeout(() => {
      // Navigation controls
      const navControls = document.querySelectorAll('.mapboxgl-ctrl-top-right, .mapboxgl-ctrl-group');
      navControls.forEach(ctrl => {
        ctrl.style.zIndex = '111';
      });

      // Draw controls
      const drawControls = document.querySelectorAll('.mapboxgl-draw_ctrl-draw-btn');
      drawControls.forEach(ctrl => {
        ctrl.style.zIndex = '112';
      });

      // Marker container
      const markerContainer = document.querySelector('.mapboxgl-marker-container');
      if (markerContainer) {
        markerContainer.style.zIndex = '100';
      }
    }, 100);

    map.on("load", () => {
      mapRef.current = map;
      drawRef.current = draw;
      tooltipControlRef.current = new TooltipControl();
      map.getContainer().appendChild(tooltipControlRef.current.onAdd(map));

      map.on("moveend", () => {
        const center = map.getCenter();
        setMapViewState({
          center: { lng: center.lng, lat: center.lat },
          zoom: map.getZoom(),
        });
      });

      map.on("draw.modechange", (e) => {
        const isDrawing = ["draw_point", "draw_polygon"].includes(e.mode);
        isDrawingRef.current = isDrawing;

        //console.log("🛠️ Draw mode changed:", e.mode);
        //console.log("🎯 Drawing state:", isDrawingRef.current);

        map.getCanvas().style.cursor = isDrawing ? "crosshair" : "";
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

      // Handle marker clicks
      map.on("click", (e) => {
        const features = draw.getAll().features;
        const clickedMarker = features.find(
          (f) =>
            f.geometry.type === "Point" &&
            turf.booleanPointInPolygon(
              turf.point(e.lngLat.toArray()),
              turf.buffer(turf.point(f.geometry.coordinates), 0.01, { units: "miles" })
            )
        );

        if (clickedMarker) {
          const markerId = clickedMarker.id;
          const radius = markerRadiusMap.current[markerId] || 1;
          showPopup(clickedMarker.geometry.coordinates, radius, markerId);
        } else if (activePopupRef.current) {
          activePopupRef.current.remove();
          activePopupRef.current = null;
        }
      });

      map.on("draw.create", (e) => {
        const feature = e.features[0];
        const featureId = feature.id;

        if (feature.geometry.type === "Point") {
          const center = feature.geometry.coordinates;
          const initialRadius = 1;
          markerRadiusMap.current[featureId] = initialRadius;

          drawCircle(center, initialRadius, map, featureId);
          showPopup(center, initialRadius, featureId);

          // 🚫 Set "just placed marker" flag
          justPlacedMarkerRef.current = true;
          setTimeout(() => {
            justPlacedMarkerRef.current = false;
          }, 100); // Delay long enough to skip the click event
        }

        if (feature.geometry.type === "Polygon") {
          autoSelectIntersectingPolygons(feature.geometry, featureId);
        }
      });

      map.on("draw.update", (e) => {
        const map = mapRef.current;
        if (!map) return;

        e.features.forEach((feature) => {
          const featureId = feature.id;

          if (feature.geometry.type === "Point") {
            const newCenter = feature.geometry.coordinates;
            const radius = markerRadiusMap.current[featureId] || 1;

            // 1. Recreate and redraw circle from updated marker
            const newCircle = drawCircle(newCenter, radius, map, featureId);

            // 2. Check intersections with all property polygons
            const allFeatures = map.querySourceFeatures("property-polygons");
            const stillIntersecting = new Set();

            allFeatures.forEach((polygon) => {
              const intersects = turf.booleanIntersects(newCircle, polygon.geometry);
              const id = polygon.id || polygon.properties?.id;

              if (intersects && polygon.properties.fillType === "blue") {
                addToCart(id);
                stillIntersecting.add(id);
              }
            });

            // 3. Deselect previously selected polygons that no longer intersect
            const previouslySelected = selectionSourceMap.current[featureId] || new Set();
            previouslySelected.forEach((id) => {
              if (!stillIntersecting.has(id)) {
                removeFromCart(id);
              }
            });

            // 4. Update selection tracking map
            selectionSourceMap.current[featureId] = stillIntersecting;
          }

          if (feature.geometry.type === "Polygon") {
            const allFeatures = map.querySourceFeatures("property-polygons");
            const stillIntersecting = new Set();

            allFeatures.forEach((polygon) => {
              const intersects = turf.booleanIntersects(feature.geometry, polygon.geometry);
              const id = polygon.id || polygon.properties?.id;

              if (intersects && polygon.properties.fillType === "blue") {
                addToCart(id);
                stillIntersecting.add(id);
              }
            });

            const previouslySelected = selectionSourceMap.current[featureId] || new Set();
            previouslySelected.forEach((id) => {
              if (!stillIntersecting.has(id)) {
                removeFromCart(id);
              }
            });

            selectionSourceMap.current[featureId] = stillIntersecting;
          }
        });
      });

      map.on("draw.delete", (e) => {
        const map = mapRef.current;

        e.features.forEach((feature) => {
          const featureId = feature.id;

          // 🧹 Deselect all polygons selected by this shape
          const polygonIds = selectionSourceMap.current[featureId];
          if (polygonIds) {
            setSelectedPolygons((prevSelected) => {
              const updated = new Set(prevSelected);
              polygonIds.forEach((polygonId) => {
                map.setFeatureState({ source: "property-polygons", id: polygonId }, { selected: false });
                //updated.delete(polygonId);
                removeFromCart(polygonId);
              });
              return updated;
            });

            delete selectionSourceMap.current[featureId];
          }

          // 🔘 Cleanup circle layer and associated tooltips
          if (feature.geometry.type === "Point") {
            const circleId = markerToCircleMap.current[featureId]?.id;
            if (circleId) {
              if (map.getLayer(circleId)) map.removeLayer(circleId);
              if (map.getSource(circleId)) map.removeSource(circleId);

              // Clean up any tooltips for this marker
              circleTooltips.current = circleTooltips.current.filter(tooltip => {
                const shouldKeep = !tooltip._lngLat ||
                  turf.distance(
                    turf.point(tooltip._lngLat.toArray()),
                    turf.point(feature.geometry.coordinates)
                  ) >= 0.01;
                if (!shouldKeep) tooltip.remove();
                return shouldKeep;
              });

              delete markerToCircleMap.current[featureId];
              delete markerRadiusMap.current[featureId];
            }
          }
        });
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
    if (minCloseDate) count++;
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
      //const closeDate = minCloseDate || undefined // Add this line
      //console.log("Close Date Filter:", closeDate);
      // 1. Fetch properties (essential)
      const propertiesResponse = await fetch("https://3h3er97cni.execute-api.us-east-1.amazonaws.com/prod/comps/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...params,
          useTypes: selectedUseTypes,
          minAcreage: minAcreage ? parseFloat(minAcreage) : undefined,
          maxAcreage: maxAcreage ? parseFloat(maxAcreage) : undefined,
          minCloseDate: minCloseDate || undefined
        }),
      });

      // Process property data
      const geojson = await propertiesResponse.json();
      //console.log("Geojson: ", geojson);
      const savedSelections = new Set(selectedPolygons);

      // Process and render properties immediately
      renderProperties(map, geojson, savedSelections);

      // 2. Fetch comp reports (lightweight)
      await fetchCompReports(params);

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

    map.on("mousemove", "property-polygons-layer", (e) => {
      const drawMode = drawRef.current?.getMode?.();
      if (drawMode === "draw_point" || drawMode === "draw_polygon") return;

      const feature = e.features[0];
      tooltipControlRef.current?.show(getTooltipContent(feature), e.lngLat);
    });

    map.on("mouseenter", "property-polygons-layer", () => {
      const drawMode = drawRef.current?.getMode?.();
      if (drawMode === "draw_point" || drawMode === "draw_polygon") return;
      map.getCanvas().style.cursor = "pointer";
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

    console.log("Total polygons:", geojson.features.length);
    console.log("Comp polygons:", geojson.features.filter(f => f.properties.fillType === "blue").length);
  };

  // Separate function for comp reports only
  const fetchCompReports = async (params) => {
    try {
      setIsLoadingCompReports(true);
      setCompReports([]); // Clear existing reports first
      const compReportsResponse = await fetch(
        `https://3h3er97cni.execute-api.us-east-1.amazonaws.com/prod/comps/search?${new URLSearchParams(params)}`,
        { method: "GET", headers: { "Content-Type": "application/json" } }
      );

      const reportsData = await compReportsResponse.json();
      if (reportsData.success) {
        setCompReports(reportsData.reports);
        //console.log("COMP REPORTS DATA: ", reportsData.reports);
      }
    } catch (err) {
      console.error("Failed to fetch comp reports:", err);
    } finally {
      setIsLoadingCompReports(false);
    }
  };

  // New function for manual insights generation
  const generateNewInsights = async () => {
    if (!mapRef.current) return;

    try {
      setIsGeneratingInsights(true);
      setShouldShowGenerateButton(false);

      const bounds = mapRef.current.getBounds();
      const params = {
        minLat: bounds.getSouth(),
        maxLat: bounds.getNorth(),
        minLng: bounds.getWest(),
        maxLng: bounds.getEast()
      };

      // 1. Fetch blue properties (comps)
      const propertiesResponse = await fetch("https://3h3er97cni.execute-api.us-east-1.amazonaws.com/prod/comps/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      const geojson = await propertiesResponse.json();
      const blueProperties = geojson.features
        .filter(f => f.properties.fillType === "blue")
        .map(f => f.properties);

      // 2. Fetch published reports (using your existing fetchCompReports logic)
      const reportsResponse = await fetch(
        `https://3h3er97cni.execute-api.us-east-1.amazonaws.com/prod/comps/search?${new URLSearchParams(params)}`,
        { method: "GET" }
      );

      const reportsData = await reportsResponse.json();
      const publishedReports = reportsData.success
        ? reportsData.reports.filter(r => r.status === "published")
        : [];

      // Prepare payload - exactly as you want it
      const aiPayload = {
        report_data: publishedReports, // All comps from all reports
        properties: blueProperties,  // All blue properties
        prompt_type: "market_insight_from_map_bounds"
      };

      //console.log("AI Payload:", aiPayload);

      if (publishedReports.length > 0 || blueProperties.length > 0) {
        const aiResponse = await fetch("https://3h3er97cni.execute-api.us-east-1.amazonaws.com/prod/ai/market_insight", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(aiPayload),
        });

        const aiJson = await aiResponse.json();
        setMarketInsightSummary(aiJson.summary || "No market insight returned.");
      } else {
        setMarketInsightSummary("Not enough data to summarize market insight.");
      }

    } catch (err) {
      console.error("AI market insight fetch failed:", err);
      setMarketInsightSummary("Could not generate market insight.");
    } finally {
      setIsGeneratingInsights(false);
    }
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
          name: item.properties.dealName || `Property ${item.id}`,
          // Include any other minimal properties needed
        }
      })),

      // User-drawn elements that selected these (optional)
      selectionSources: {
        polygons: drawRef.current?.getAll()?.features
          ?.filter(f => f.geometry.type === "Polygon")
          ?.map(f => f.geometry.coordinates[0]) || [],
        circles: Object.entries(markerRadiusMap.current).map(([markerId, radius]) => ({
          center: markerToCircleMap.current[markerId]?.center,
          radius
        }))
      }
    };
  };

  // New effect to clear insights when map moves significantly
  useEffect(() => {
    if (!mapRef.current || !lastInsightBounds) return;

    const map = mapRef.current;

    const handleMoveEnd = () => {
      const currentBounds = map.getBounds();
      const boundsChangedSignificantly =
        Math.abs(currentBounds.getNorth() - lastInsightBounds.getNorth()) > 0.1 ||
        Math.abs(currentBounds.getSouth() - lastInsightBounds.getSouth()) > 0.1 ||
        Math.abs(currentBounds.getEast() - lastInsightBounds.getEast()) > 0.1 ||
        Math.abs(currentBounds.getWest() - lastInsightBounds.getWest()) > 0.1;

      if (boundsChangedSignificantly) {
        setMarketInsightSummary(null);
      }
    };

    map.on('moveend', handleMoveEnd);
    return () => map.off('moveend', handleMoveEnd);
  }, [lastInsightBounds]);

  const drawCircle = (center, radius, map, markerId) => {
    const circleId = `circle-${markerId}`;

    if (map.getLayer(circleId)) map.removeLayer(circleId);
    if (map.getSource(circleId)) map.removeSource(circleId);

    const circle = turf.circle(center, radius, { steps: 64, units: "miles" });

    map.addSource(circleId, {
      type: "geojson",
      data: circle,
    });

    map.addLayer(
      {
        id: circleId,
        type: "fill",
        source: circleId,
        paint: {
          "fill-color": "#00aaff",
          "fill-opacity": 0.3,
        },
      },
      "road-label"
    );

    // Store both the circle ID and its center coordinates
    markerToCircleMap.current[markerId] = {
      id: circleId,
      center: center
    };
    markerRadiusMap.current[markerId] = radius;
    return circle;
  };

  const showPopup = (center, radius, markerId) => {
    if (activePopupRef.current) {
      activePopupRef.current.remove();
    }

    lastOpenedPopupMarkerIdRef.current = markerId;
    hasAdjustedRadiusRef.current[markerId] = false; // 🔁 Reset flag

    const popup = new mapboxgl.Popup({
      closeOnClick: true,
      className: 'radius-menu-popup' // ✅ Add a custom class to the popup
    })
      .setLngLat(center)
      .setHTML(`
        <div style="font-family: sans-serif;">
          <strong>Radius:</strong> <span id="radiusValue">${radius.toFixed(2)} mi</span><br/>
          <button id="decreaseRadius">-</button>
          <button id="increaseRadius">+</button>
        </div>
      `)
      .addTo(mapRef.current);

    activePopupRef.current = popup;

    // ✅ Manually bump z-index AFTER popup renders
    setTimeout(() => {
      const el = document.querySelector('.radius-menu-popup');
      if (el) el.style.zIndex = '2000'; // Must be >10 to beat DMRE marker z-index
    }, 0);

    popup.on("close", () => {
      const map = mapRef.current;
      if (!map) {
        console.warn("⚠️ Popup closed, but mapRef is undefined.");
        return;
      }

      const finalRadius = markerRadiusMap.current[markerId];
      if (finalRadius === undefined) {
        console.warn("⚠️ Marker radius not found (probably deleted). Skipping intersection.");
        return;
      }

      const buffered = turf.buffer(turf.point(center), finalRadius, { units: "miles" });

      if (lastOpenedPopupMarkerIdRef.current === markerId) {
        //console.log("✅ Popup closed. Running intersection…");

        const allFeatures = map.querySourceFeatures("property-polygons");
        const currentSelectedForThisMarker = selectionSourceMap.current[markerId] || new Set();
        const nextSelectedForThisMarker = new Set();

        allFeatures.forEach((feature) => {
          const id = feature.id || feature.properties?.id;
          const polygonGeometry = feature.geometry;
          const intersects = turf.booleanIntersects(buffered.geometry, polygonGeometry);

          if (intersects && feature.properties.fillType === "blue") {
            nextSelectedForThisMarker.add(id);
            if (!currentSelectedForThisMarker.has(id)) {
              // Get the full feature data
              const fullFeature = map.querySourceFeatures("property-polygons")
                .find(f => (f.id || f.properties?.id) === id);

              if (fullFeature) {
                // Update reportGeoData
                setReportGeoData(prev => ({
                  ...prev,
                  [id]: {
                    geometry: fullFeature.geometry,
                    properties: {
                      dealName: fullFeature.properties.dealName,
                      acreage: fullFeature.properties.acreage
                    }
                  }
                }));
                //console.log("🌐 Added via circle - Feature:", {
                //  id,
                //  geometry: fullFeature.geometry,
                //  properties: fullFeature.properties
                //});
              }
              addPolygonToSelection(id);
            }
          }
        });

        currentSelectedForThisMarker.forEach((id) => {
          if (!nextSelectedForThisMarker.has(id)) {
            togglePolygonSelection(id);
          }
        });

        selectionSourceMap.current[markerId] = nextSelectedForThisMarker;
      }
    });

    // Radius buttons
    setTimeout(() => {
      const radiusValue = document.getElementById("radiusValue");

      document.getElementById("decreaseRadius").onclick = () => {
        const newRadius = Math.max(0.25, markerRadiusMap.current[markerId] - 0.25);
        markerRadiusMap.current[markerId] = newRadius;
        hasAdjustedRadiusRef.current[markerId] = true; // ✅ Mark as changed
        drawCircle(center, newRadius, mapRef.current, markerId);
        if (radiusValue) radiusValue.innerText = `${newRadius.toFixed(2)} mi`;
      };

      document.getElementById("increaseRadius").onclick = () => {
        const newRadius = markerRadiusMap.current[markerId] + 0.25;
        markerRadiusMap.current[markerId] = newRadius;
        hasAdjustedRadiusRef.current[markerId] = true; // ✅ Mark as changed
        drawCircle(center, newRadius, mapRef.current, markerId);
        if (radiusValue) radiusValue.innerText = `${newRadius.toFixed(2)} mi`;
      };
    }, 0);
  };

  useEffect(() => {
    window.__FACTOR_DEBUG__ = {
      mapRef,
      drawRef,
      markerToCircleMap,
      markerRadiusMap,
    };
  }, []);

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
        <img src="/factor_comps_logo.png" alt="Factor Comps" style={{ width: "200px", height: "auto" }} />
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Tooltip title="Comp Reports Dashboard">
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

              {Object.keys(markerRadiusMap.current).length > 0 && (
                <Tooltip title={showCircleRadii ? "Hide radii" : "Show radii"}>
                  <IconButton
                    onClick={toggleCircleRadii}
                    sx={{
                      backgroundColor: "white",
                      boxShadow: 3,
                      '&:hover': { backgroundColor: "#f0f0f0" }
                    }}
                  >
                    <FilterTiltShiftOutlinedIcon color={showCircleRadii ? "primary" : "inherit"} />
                  </IconButton>
                </Tooltip>
              )}
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
                    <Tooltip title="Factor Genius">
                      <IconButton
                        onClick={() => {
                          setInsightsOpen(!insightsOpen);
                          setShouldShowGenerateButton(true);
                        }}
                        sx={{
                          backgroundColor: "white",
                          boxShadow: 3,
                          '&:hover': {
                            backgroundColor: "#f0f0f0",
                            transform: 'scale(1.1)',
                          },
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <InsightsIcon color={marketInsightSummary ? "primary" : "inherit"} />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Comp Reports">
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
        minCloseDate={minCloseDate}
        setMinCloseDate={setMinCloseDate}
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

      {/* Insights Panel */}
      <Collapse
        in={insightsOpen}
        sx={{
          position: "absolute",
          bottom: isMobile() ? 210 : 134,
          left: 24,
          zIndex: 1000,
          width: isMobile() ? 'calc(100% - 48px)' : 340,
        }}
      >
        <Paper
          elevation={3}
          sx={{
            borderRadius: 2,
            overflow: 'hidden',
            maxHeight: 400,
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <Box
            sx={{
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              p: 1.5,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LightbulbIcon fontSize="small" />
              <Typography variant="subtitle1">Factor Genius</Typography>
            </Box>
            <Box>
              <IconButton
                size="small"
                onClick={() => setInsightsOpen(false)}
                sx={{ color: 'primary.contrastText' }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>

          <Box sx={{ p: 2, maxHeight: 300, overflow: 'auto' }}>
            {isGeneratingInsights ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <CircularProgress size={24} sx={{ mb: 1 }} />
                <Typography variant="body2">Analyzing properties...</Typography>
              </Box>
            ) : marketInsightSummary ? (
              <>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  {marketInsightSummary}
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={generateNewInsights}
                    startIcon={<RefreshIcon fontSize="small" />}
                  >
                    Refresh Insights
                  </Button>
                </Box>
              </>
            ) : (
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  No insights generated yet
                </Typography>
                <Button
                  variant="contained"
                  onClick={generateNewInsights}
                  startIcon={<InsightsIcon />}
                  sx={{ width: '100%' }}
                >
                  Generate Insights
                </Button>
              </Box>
            )}
          </Box>
        </Paper>
      </Collapse>

      {/* Report Builder */}
      {console.log('DEBUG - reportGeoData before ReportBuilder:', reportGeoData)}
      {navigationState.showReport && (
        <ReportBuilder
          cartItems={reportBuilderState?.cartItems || cartItems}
          initialGeoData={reportBuilderState?.geoData || reportGeoData}
          setCartItems={setCartItems}
          drawnFeatures={{
            markers: Object.entries(markerRadiusMap.current).map(([markerId, radius]) => ({
              markerId,
              center: markerToCircleMap.current[markerId]?.center,
              radius,
            })),
            polygons: drawRef.current
              ?.getAll()
              ?.features
              ?.filter(f => f.geometry.type === "Polygon")
              ?.map(f => f.geometry.coordinates[0]) || []
          }}
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
