module powerbi.extensibility.visual {
export interface IRotationSettings {
     show: boolean;
  }

export interface IAnimationSettings {
    show: boolean;
 }

export interface IGradientSettings {
  show: boolean;
}

export interface IOrientationSettings {
  show: boolean;
  showFlip: boolean;
}

export interface ILegendDataPoint {
  category: string;
  color: string;
  identity: powerbi.visuals.ISelectionId;
  selected: boolean;
}

export interface ILegendConfig {
  show: boolean;
  legendName: string;
  showTitle: boolean;
  labelColor: string;
  fontSize: number;
  fontFamily: string;
  sizeLegendColor: string;
  displayUnits: number;
  decimalPlaces: number;
}

export interface ITooltipDataPoints {
  name: string;
  // tslint:disable-next-line:no-any
  value: any;
  formatter: string;
}

export interface IColorSettings {
   color: string;
}

export interface ICategoryLabelSettings {
   show: boolean;
   fontColor: string;
   fontFamily: string ;
   fontSize: number;
}

// tslint:disable-next-line:max-classes-per-file
export interface ISeparatorSettings {
   show: boolean;
   color: string ;
   strokeWidth: number;
   lineType: string ;
}
// tslint:disable-next-line:max-classes-per-file
export interface ILegendSettings {
    show: boolean;
    position: string;
}
// tslint:disable-next-line:max-classes-per-file
export interface IEnableTooltipSettings {
   show: boolean ;
}
// tslint:disable-next-line:max-classes-per-file
export interface IConversionSettings {
   show: boolean ;
   label: string ;
   labelfontColor: string ;
   fontSize: number;
   fontColor: string ;
   labelPrecision: number;
   transparency: number;
   displayValue: string;
}
// Interface for Detail Labels
// tslint:disable-next-line:max-classes-per-file
export interface IDetailLabelSettings {
   show: boolean ;
   fontFamily: string;
   fontSize: number;
   color: string ;
   labelDisplayUnits: number;
   labelPrecision: number;
}

}
