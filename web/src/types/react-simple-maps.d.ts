declare module "react-simple-maps" {
  import type { ReactNode, MouseEvent, SVGProps } from "react";

  export interface ProjectionConfig {
    center?: [number, number];
    scale?: number;
    rotate?: [number, number, number];
    parallels?: [number, number];
  }

  export interface ComposableMapProps {
    projection?: string;
    projectionConfig?: ProjectionConfig;
    width?: number;
    height?: number;
    style?: React.CSSProperties;
    className?: string;
    children?: ReactNode;
  }

  export interface ZoomableGroupProps {
    zoom?: number;
    center?: [number, number];
    minZoom?: number;
    maxZoom?: number;
    children?: ReactNode;
    onMoveStart?: (pos: { x: number; y: number; k: number }) => void;
    onMove?: (pos: { x: number; y: number; k: number }) => void;
    onMoveEnd?: (pos: { x: number; y: number; k: number }) => void;
  }

  export interface GeographyStyle {
    default?: React.CSSProperties & { outline?: string; cursor?: string; fill?: string; transition?: string };
    hover?: React.CSSProperties & { outline?: string; fill?: string; opacity?: number };
    pressed?: React.CSSProperties & { outline?: string };
  }

  export interface GeoFeature {
    rsmKey: string;
    id?: string;
    properties: Record<string, unknown>;
    geometry: {
      type: string;
      coordinates: number[][][];
    };
  }

  export interface GeographiesProps {
    geography: string | object;
    children: (args: { geographies: GeoFeature[]; outline: GeoFeature; sphere: GeoFeature }) => ReactNode;
    parseGeographies?: (geographies: GeoFeature[]) => GeoFeature[];
  }

  export interface GeographyProps extends SVGProps<SVGPathElement> {
    geography: GeoFeature;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    style?: GeographyStyle;
    onMouseEnter?: (event: MouseEvent<SVGPathElement>) => void;
    onMouseLeave?: (event: MouseEvent<SVGPathElement>) => void;
    onClick?: (event: MouseEvent<SVGPathElement>) => void;
  }

  export interface MarkerProps {
    coordinates: [number, number];
    children?: ReactNode;
    className?: string;
    style?: React.CSSProperties;
    onClick?: () => void;
  }

  export interface AnnotationProps {
    subject: [number, number];
    dx?: number;
    dy?: number;
    children?: ReactNode;
    connectorProps?: SVGProps<SVGPathElement>;
  }

  export function ComposableMap(props: ComposableMapProps): JSX.Element;
  export function ZoomableGroup(props: ZoomableGroupProps): JSX.Element;
  export function Geographies(props: GeographiesProps): JSX.Element;
  export function Geography(props: GeographyProps): JSX.Element;
  export function Marker(props: MarkerProps): JSX.Element;
  export function Annotation(props: AnnotationProps): JSX.Element;
  export function Graticule(props: SVGProps<SVGPathElement>): JSX.Element;
  export function Sphere(props: SVGProps<SVGPathElement>): JSX.Element;
  export function Line(props: { from: [number, number]; to: [number, number] } & SVGProps<SVGPathElement>): JSX.Element;

  export function useGeographies(args: { geography: string | object }): { geographies: GeoFeature[]; outline: GeoFeature; sphere: GeoFeature };
  export function useMapContext(): unknown;
  export function useZoomPan(): unknown;
}
