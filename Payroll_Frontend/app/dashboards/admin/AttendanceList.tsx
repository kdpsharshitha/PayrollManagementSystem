import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import 'ol/ol.css';
import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import Overlay from 'ol/Overlay';
import { fromLonLat } from 'ol/proj';
import { getAccessToken } from '../../auth/index';
import SegmentedControl from '@react-native-segmented-control/segmented-control';

const BASE_URL = 'http://192.168.220.49:8000/api/attendance';

interface AttendanceRecord {
  id: number;
  emp_id: number;
  emp_name: string | null;
  date: string;
  entry_time: string | null;
  exit_time: string | null;
  entry_latitude: string | null;
  entry_longitude: string | null;
  exit_latitude: string | null;
  exit_longitude: string | null;
}

interface EmployeeRecord {
  id: number;
  emp_id: number;
  emp_name: string;
}

interface ApiResponse {
  marked: AttendanceRecord[];
  unmarked: any[];
}

export default function AdminAttendanceWeb() {
  const mapElement = useRef<HTMLDivElement | null>(null);
  const [map, setMap] = useState<Map | null>(null);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [markedRecords, setMarkedRecords] = useState<AttendanceRecord[]>([]);
  const [unmarkedEmployees, setUnmarkedEmployees] = useState<EmployeeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);

  const fetchRecords = async (ds: string) => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      const res = await axios.get<ApiResponse>(`${BASE_URL}/by-date/`, {
        params: { date: ds },
        headers: { Authorization: `Bearer ${token}` },
      });
      const actualMarked = res.data.marked.filter(r => r.entry_time);
      const placeholderRows = res.data.marked.filter(r => !r.entry_time);

      const backendUnmarked: EmployeeRecord[] = res.data.unmarked.map(u => ({ id: Number(u.id), emp_id: Number(u.id), emp_name: u.name ?? u.email }));
      const placeholderUnmarked: EmployeeRecord[] = placeholderRows.map(r => ({ id: r.emp_id, emp_id: r.emp_id, emp_name: r.emp_name ?? '—' }));

      setMarkedRecords(actualMarked);
      setUnmarkedEmployees([...backendUnmarked, ...placeholderUnmarked]);
      setSelectedRecord(null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!map && mapElement.current) {
      const initialMap = new Map({ target: mapElement.current, layers: [new TileLayer({ source: new OSM() })], view: new View({ center: fromLonLat([0, 0]), zoom: 2 }) });
      setMap(initialMap);
    }
  }, [map]);

  useEffect(() => { fetchRecords(date); }, [date]);

  // redraw overlays for selected record
  useEffect(() => {
    if (!map) return;
    map.getOverlays().clear();
    if (selectedIndex !== 0 || !selectedRecord) return;

    const points = [
      { lat: selectedRecord.entry_latitude, lng: selectedRecord.entry_longitude, label: 'In',  offset: [0, -15] },
      { lat: selectedRecord.exit_latitude,  lng: selectedRecord.exit_longitude,  label: 'Out', offset: [0, 15]  }
    ];

    points.forEach(({ lat, lng, label, offset }) => {
      const latNum = Number(lat);
      const lngNum = Number(lng);
      if (isNaN(latNum) || isNaN(lngNum)) return;

      const marker = document.createElement('div');
      marker.style.width = '24px'; marker.style.height = '24px'; marker.style.borderRadius = '50%';
      marker.style.backgroundColor = label === 'In' ? '#28a745' : '#dc3545';
      marker.style.color = '#ffffff'; marker.style.display = 'flex'; marker.style.alignItems = 'center';
      marker.style.justifyContent = 'center'; marker.style.fontSize = '12px'; marker.style.fontWeight = 'bold';
      marker.style.cursor = 'pointer'; marker.style.border = '2px solid #ffffff'; marker.style.boxShadow = '0 0 2px rgba(0,0,0,0.3)';
      marker.innerText = label; marker.title = `${label} — click to open in Google Maps`;
      marker.onclick = () => window.open(`https://maps.google.com?q=${latNum},${lngNum}`, '_blank');

      map.addOverlay(new Overlay({ position: fromLonLat([lngNum, latNum]), positioning: 'center-center', element: marker, offset, stopEvent: false }));
    });

    const validCoords = points.map(p => [Number(p.lng), Number(p.lat)]).filter(([lon, lat]) => !isNaN(lon) && !isNaN(lat));
    if (validCoords.length) {
      const avgLon = validCoords.reduce((sum, p) => sum + p[0], 0) / validCoords.length;
      const avgLat = validCoords.reduce((sum, p) => sum + p[1], 0) / validCoords.length;
      map.getView().animate({ center: fromLonLat([avgLon, avgLat]), zoom: 15, duration: 500 });
    }
  }, [map, selectedRecord, selectedIndex]);

  // ensure map properly resizes when returning to Recorded tab
  useEffect(() => {
    if (map && selectedIndex === 0) {
      map.updateSize();
    }
  }, [map, selectedIndex]);

  const itemsToShow = selectedIndex === 0 ? markedRecords : unmarkedEmployees;
  const handleCardClick = (r: AttendanceRecord) => setSelectedRecord(r);

  return (
    <div style={styles.scrollContainer}>
      <div style={styles.container}>
        {/* Stats */}
        <div style={styles.statsRow}>
          <div style={{ ...styles.statCard, ...styles.statMarked }}><div style={styles.statNumber}>{markedRecords.length}</div><div style={styles.statLabel}>Attendance Recorded</div></div>
          <div style={{ ...styles.statCard, ...styles.statUnmarked }}><div style={styles.statNumber}>{unmarkedEmployees.length}</div><div style={styles.statLabel}>Attendance Pending</div></div>
        </div>

        {/* Controls */}
        <div style={styles.headerRow}>
          <div style={styles.segmentContainer}>
            <SegmentedControl values={['Recorded','Pending']} selectedIndex={selectedIndex}
              onChange={e => { setSelectedIndex(e.nativeEvent.selectedSegmentIndex); setSelectedRecord(null); }} style={{ width: '100%' }} />
          </div>
          <div style={styles.dateSelector}>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={styles.dateInput} />
            <button onClick={() => fetchRecords(date)} disabled={loading} style={{ ...styles.button, ...(loading ? styles.buttonDisabled : {}) }}>{loading ? 'Loading…' : 'Reload'}</button>
          </div>
        </div>

        {/* Map always mounted but hidden when Pending */}
        <section
          ref={mapElement}
          style={{
            ...styles.mapContainer,
            display: selectedIndex === 0 ? 'block' : 'none'
          }}
        />

        {/* List */}
        <section style={styles.section}>
         
            {itemsToShow.length === 0 ? <p>No {selectedIndex === 0 ? 'marked' : 'unmarked'} entries.</p> : <CardGrid items={itemsToShow} isMarked={selectedIndex===0} onCardClick={handleCardClick} selectedId={selectedRecord?.id} />}
          
        </section>
      </div>
    </div>
  );
}

const CardGrid: React.FC<{ items: (AttendanceRecord|EmployeeRecord)[]; isMarked: boolean; onCardClick?: (r: AttendanceRecord)=>void; selectedId?: number }> = ({ items, isMarked, onCardClick, selectedId }) => (
  <div style={styles.gridColumn}>
    {items.map((r, idx) => (
      <div key={r.id} style={{ ...styles.rowCard, border: selectedId===r.id?'2px solid #3498db':undefined, cursor: isMarked&&onCardClick?'pointer':'default' }} onClick={() => isMarked&&onCardClick&&onCardClick(r as AttendanceRecord)}>
        <span style={styles.serialNumber}>{idx+1}</span>
        <span style={styles.cell}>{r.emp_id}</span>
        <span style={styles.cell}>{r.emp_name||'—'}</span>
        <span style={styles.cell}>{isMarked&&'entry_time'in r?<a href={`https://maps.google.com?q=${(r as AttendanceRecord).entry_latitude},${(r as AttendanceRecord).entry_longitude}`} target="_blank" rel="noopener noreferrer" style={styles.link}>{(r as AttendanceRecord).entry_time||'—'}</a>:'—'}</span>
        <span style={styles.cell}>{isMarked&&'exit_time'in r?<a href={`https://maps.google.com?q=${(r as AttendanceRecord).exit_latitude},${(r as AttendanceRecord).exit_longitude}`} target="_blank" rel="noopener noreferrer" style={styles.link}>{(r as AttendanceRecord).exit_time||'—'}</a>:'—'}</span>
      </div>
    ))}
  </div>
);

const styles: { [key: string]: React.CSSProperties } = {
  scrollContainer: { height: '100vh', overflowY: 'auto' },
  container: { padding: '20px 40px 40px', fontFamily: "'Segoe UI',Tahoma,Geneva,Verdana,sans-serif", background: '#f2f6fc', color: '#333' },
  statsRow: { display: 'flex', justifyContent: 'space-between', marginBottom: '12px' },
  statCard: { flex:1,padding:'16px',borderRadius:'12px',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',margin:'0 8px',boxShadow:'0 1px 3px rgba(0,0,0,0.08)'},
  statMarked:{backgroundColor:'#e6f7ff'},statUnmarked:{backgroundColor:'#fff5e6'},
  statNumber:{fontSize:'28px',fontWeight:700,color:'#333'},statLabel:{fontSize:'14px',color:'#666',marginTop:'4px'},

  headerRow:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'20px',width:'100%'},
  segmentContainer:{display:'flex',alignItems:'center',width:'50%',minWidth:'200px'},
  dateSelector:{display:'flex',alignItems:'center',gap:'10px'},dateInput:{padding:'8px 12px',borderRadius:'4px',border:'1px solid #ccc'},
  button:{padding:'10px 20px',background:'#3498db',color:'#fff',border:'none',borderRadius:'4px',cursor:'pointer'},buttonDisabled:{background:'#95a5a6',cursor:'not-allowed'},

  section:{marginBottom:'50px'},scrollView:{maxHeight:'400px',overflowY:'auto',paddingRight:'8px'},gridColumn:{display:'grid',gridTemplateColumns:'1fr',gap:'16px'},
  rowCard:{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'20px 16px',background:'#fff',borderRadius:'8px',boxShadow:'0 2px 6px rgba(0,0,0,0.05)'},
  cell:{flex:'0 0 auto',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'},link:{textDecoration:'none',fontWeight:500},

  mapContainer:{width:'100%',height:'300px',borderRadius:'8px',overflow:'hidden',boxShadow:'0 4px 12px rgba(0,0,0,0.1)'},
  serialNumber:{width:'30px',height:'30px',borderRadius:'50%',backgroundColor:'#3498db',color:'#fff',display:'inline-flex',alignItems:'center',justifyContent:'center',fontWeight:'bold'}
};
