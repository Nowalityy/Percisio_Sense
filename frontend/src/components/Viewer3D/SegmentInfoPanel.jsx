import { useState, useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useSceneStore } from '../../store';
import { getSegmentColor, SEGMENTS } from './medicalColors';

function calculateSegmentStats(scene, segmentName) {
  const objects = [];
  const box = new THREE.Box3();

  scene.traverse((child) => {
    if (child.isMesh && child.name === segmentName && child.visible) {
      objects.push(child);
      box.expandByObject(child);
    }
  });

  if (objects.length === 0) {
    return null;
  }

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const volume = size.x * size.y * size.z;

  let totalVertices = 0;
  let totalFaces = 0;

  objects.forEach((obj) => {
    if (obj.geometry) {
      if (obj.geometry.attributes.position) {
        totalVertices += obj.geometry.attributes.position.count;
      }
      if (obj.geometry.index) {
        totalFaces += obj.geometry.index.count / 3;
      } else if (obj.geometry.attributes.position) {
        totalFaces += obj.geometry.attributes.position.count / 3;
      }
    }
  });

  return {
    name: segmentName,
    objectCount: objects.length,
    boundingBox: {
      size: { x: size.x, y: size.y, z: size.z },
      center: { x: center.x, y: center.y, z: center.z },
    },
    volume,
    vertices: totalVertices,
    faces: Math.round(totalFaces),
  };
}

function formatNumber(num) {
  if (num < 0.01) {
    return num.toExponential(2);
  }
  if (num < 1) {
    return num.toFixed(3);
  }
  return num.toFixed(2);
}

export function SegmentInfoPanel({ segmentName, onClose }) {
  const { scene } = useThree();
  const [stats, setStats] = useState(null);
  const color = getSegmentColor(segmentName);

  useEffect(() => {
    if (!segmentName) {
      return;
    }

    const calculatedStats = calculateSegmentStats(scene, segmentName);
    setStats(calculatedStats);
  }, [scene, segmentName]);

  if (!segmentName || !stats) {
    return null;
  }

  return (
    <div className="absolute bottom-4 left-4 z-30 w-72 bg-white rounded-xl shadow-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 capitalize">
          {segmentName.replace(/-/g, ' ')}
        </h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded-full border border-gray-300"
            style={{ backgroundColor: color }}
          />
          <span className="text-xs text-gray-600">Couleur: {color}</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-gray-500">Objets:</span>
            <span className="ml-2 font-medium text-gray-900">{stats.objectCount}</span>
          </div>
          <div>
            <span className="text-gray-500">Vertices:</span>
            <span className="ml-2 font-medium text-gray-900">{stats.vertices.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-gray-500">Faces:</span>
            <span className="ml-2 font-medium text-gray-900">{stats.faces.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-gray-500">Volume:</span>
            <span className="ml-2 font-medium text-gray-900">{formatNumber(stats.volume)}</span>
          </div>
        </div>

        <div className="pt-2 border-t border-gray-200">
          <div className="text-xs text-gray-500 mb-1">Dimensions (m):</div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-gray-400">X:</span>
              <span className="ml-1 font-medium text-gray-900">{formatNumber(stats.boundingBox.size.x)}</span>
            </div>
            <div>
              <span className="text-gray-400">Y:</span>
              <span className="ml-1 font-medium text-gray-900">{formatNumber(stats.boundingBox.size.y)}</span>
            </div>
            <div>
              <span className="text-gray-400">Z:</span>
              <span className="ml-1 font-medium text-gray-900">{formatNumber(stats.boundingBox.size.z)}</span>
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-gray-200">
          <div className="text-xs text-gray-500 mb-1">Centre (m):</div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-gray-400">X:</span>
              <span className="ml-1 font-medium text-gray-900">{formatNumber(stats.boundingBox.center.x)}</span>
            </div>
            <div>
              <span className="text-gray-400">Y:</span>
              <span className="ml-1 font-medium text-gray-900">{formatNumber(stats.boundingBox.center.y)}</span>
            </div>
            <div>
              <span className="text-gray-400">Z:</span>
              <span className="ml-1 font-medium text-gray-900">{formatNumber(stats.boundingBox.center.z)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
