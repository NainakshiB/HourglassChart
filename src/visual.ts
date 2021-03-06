/*
 *  Power BI Visual CLI
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ''Software''), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

module powerbi.extensibility.visual {
    'use strict';
    let legendValues: {};
    legendValues = {};
    let legendValuesTorender: {};
    legendValuesTorender = {};
    import ISelectionId = powerbi.visuals.ISelectionId;
    import TextProperties = powerbi.extensibility.utils.formatting.TextProperties;
    import textMeasurementService = powerbi.extensibility.utils.formatting.textMeasurementService;
    import PixelConverter = powerbi.extensibility.utils.type.PixelConverter;
    import ValueFormatter = powerbi.extensibility.utils.formatting.valueFormatter;
    import IValueFormatter = powerbi.extensibility.utils.formatting.IValueFormatter;
    import ILegend = powerbi.extensibility.utils.chart.legend.ILegend;
    import LegendPosition = powerbi.extensibility.utils.chart.legend.LegendPosition;
    import IInteractivityService = powerbi.extensibility.utils.interactivity.IInteractivityService;
    import createLegend = powerbi.extensibility.utils.chart.legend.createLegend;
    import LegendData = powerbi.extensibility.utils.chart.legend.LegendData;

    interface IVisualViewModel {
        dataPoints: IVisualDataPoint[];
        categoryName: string;
        sourceName: string;
        measureName: string;
        destinationName: string;
        sumOfSource: number;
        sumOfDestination: number;
        fontColor: string;
        fontSize: number;
    }

    interface IVisualDataPoint {
        category: PrimitiveValue;
        source: number;
        destination: number;
        color: string;
        selectionId: ISelectionId;
        dataPercentageSource: string;
        dataPercentageDestination: string;
        tooltipData: ITooltipDataPoints[];
    }

    /**
     * Gets property value for a particular object in a category.
     *
     * @function
     * @param {DataViewCategoryColumn} category  -  List of category objects.
     * @param {number} index                     -  Index of category object.
     * @param {string} objectName                -  Name of desired object.
     * @param {string} propertyName              -  Name of desired property.
     * @param {T} defaultValue                   -  Default value of desired property.
     */
    export function getCategoricalObjectValue<T>(category: DataViewCategoryColumn, index: number,
                                                 objectName: string, propertyName: string, defaultValue: T): T {
        const categoryObjects: DataViewObjects[] = category.objects;
        if (categoryObjects) {
            const categoryObject: DataViewObject = categoryObjects[index];
            if (categoryObject) {
                const object: DataViewPropertyValue = categoryObject[objectName];
                if (object) {
                    const property: T = <T>object[propertyName];
                    if (property !== undefined) {
                        return property;
                    }
                }
            }
        }

        return defaultValue;
    }
    export function getAutoByUnits(dataValue: string, displayUnits: number): number {
        let dataValueLength: number;
        if (dataValue === null || dataValue === '') {
            return displayUnits;
        } else {
            dataValueLength = dataValue.toString().length;
        }

        if (dataValueLength >= 4 && dataValueLength < 6) {
            displayUnits = 1001;
        } else if (dataValueLength >= 6 && dataValueLength < 9) {
            displayUnits = 1e6;
        } else if (dataValueLength >= 9 && dataValueLength < 12) {
            displayUnits = 1e9;
        } else if (dataValueLength >= 12) {
            displayUnits = 1e12;
        }

        return displayUnits;
    }

    export class Visual implements IVisual {
        private target: HTMLElement;
        private updateCount: number;
        private host: IVisualHost;
        private visualModel: IVisualViewModel;
        private visualCont: d3.Selection<SVGElement>;
        private categoryLabelDiv: d3.Selection<SVGElement>;
        private detailLabelDiv: d3.Selection<SVGElement>;
        private mainContainer: d3.Selection<SVGElement>;
        private tooltipServiceWrapper: ITooltipServiceWrapper;
        private visualDataPoint: IVisualDataPoint[];
        private visualSelection: d3.selection.Update<IVisualDataPoint>;
        public static legendDataPoints: ILegendDataPoint[] = [];
        public static legend: ILegend;
        public static legendTitle: string;
        private legendSetting: ILegendConfig;
        private baseContainer: d3.Selection<SVGElement>;
        private svg: d3.Selection<SVGElement>;
        private interactivityService: IInteractivityService;
        // tslint:disable-next-line:no-any
        private dataViews: any;
        private sourceFormat: string;
        private destinationFormat: string;
        private static visibilityTextLabel: boolean = true;
        private static selectionManager: ISelectionManager;
        public static catSizePresent: boolean;
        public static isColorCategoryPresent: boolean;

        // Constants
        public static MAXWIDTHRATIO: number = 0.9;
        public static MAXHEIGHTRATIO: number = 0.9;
        private static cX: number;
        private static cY: number;
        private viewport: IViewport;
        private static categoryLabelSettings: ICategoryLabelSettings;
        private static separatorSettings: ISeparatorSettings;
        private static conversionSettings: IConversionSettings;
        private static detailLabelSettings: IDetailLabelSettings;
        public rotationSettings: IRotationSettings;
        private static gradientSettings: IGradientSettings;
        public orientationSettings: IOrientationSettings;
        public animationSettings: IAnimationSettings;
        public static SOURCEMEASURELABELRELATIVEHEIGHT: number = 0.053;
        public static DESTINATIONMEASURELABELRELATIVEHEIGHT: number = 0.873;
        public static MINCONVERSIONBOXWIDTH: number = 0.05;
        public static conversionBoxWidth: number = 0;
        public static MINCONVERSIONBOXHEIGHT: number = 0.07;
        public static SOURCEDATALABELRELATIVEHEIGHT: number = 0.09;
        public static DESTINATIONDATALABELRELATIVEHEIGHT: number = 0.9;
        public static MAXLENGTHMEASURELABEL: number = 0.19;
        public static MAXWIDTHMEASURELABEL: number = 0.3;
        public static sourceStringLiteral: string = 'source';
        public static destinationStringLiteral: string = 'destination';
        public static percentageLiteral: string = '%';
        public static openBracketLiteral: string = '(';
        public static closeBracketLiteral: string = ')';
        public static pxLiteral: string = 'px';
        public static classListLiteral: string = 'classList';
        public static upperTriLiteral: string = 'upperTri';
        public static lowerTriLiteral: string = 'lowerTri';
        public static dotLiteral: string = '.';
        public static measureLabelDestLiteral: string = 'measureLabelDest';
        public static textLabelLiteral: string = 'textLabel';
        public static emptyString: string = '';
        public static measureLabelLiteral: string = 'measureLabel';
        public static percentageBgLiteral: string = 'percentageBg';
        public static conversionBoxLiteral: string = 'conversionBox';
        public static spaceLiteral: string = ' ';
        public static percentageValueLiteral: string = 'percentageValue';
        public static conversionValueLiteral: string = 'conversionValue';
        public static flag: number = 0;
        public static dataLabelFlip: boolean = false;
        public static orientation: number = 0;
        private dataView: DataView;
        private static maxBaseWidth: number;
        private static maxBaseHeight: number;
        private static widthCategoryLabel: number = 0;
        private static heightCategoryLabel: number = 0;
        public myStyles: d3.Selection<SVGElement>;
        private gradient: d3.Selection<SVGElement>;

        constructor(options: VisualConstructorOptions) {
            this.interactivityService = powerbi.extensibility.utils.interactivity.createInteractivityService(options.host);
            this.host = options.host;
            this.target = options.element;
            this.tooltipServiceWrapper = createTooltipServiceWrapper(this.host.tooltipService, options.element);
            Visual.selectionManager = options.host.createSelectionManager();
            // tslint:disable-next-line:no-any
            const targetContainer: d3.Selection<any> = d3.select(this.target);

            this.mainContainer = targetContainer
                .append('div')
                .classed('mainContainer', true);
            this.categoryLabelDiv = this.mainContainer
                .append('div')
                .classed('categoryLabelContainer', true);
            this.visualCont = this.mainContainer
                .append('svg')
                .classed('visualContainer', true);

            Visual.legend = powerbi.extensibility.utils.chart.legend.createLegend(
                options.element,
                options.host && false,
                this.interactivityService,
                true);
        }

        public VisualTransform(options: VisualUpdateOptions, host: IVisualHost): IVisualViewModel {
            const dataViews: DataView[] = options.dataViews;
            let len: number;
            let iIndexOfCategory: number = -1;
            let iIndexOfSource: number = -1;
            let iIndexOfDestination: number = -1;

            const viewModel: IVisualViewModel = {
                dataPoints: [],
                categoryName: '',
                sourceName: '',
                measureName: '',
                destinationName: '',
                sumOfSource: 0,
                sumOfDestination: 0,
                fontSize: 10,
                fontColor: '#000'
            };
            if (options.dataViews[0].categorical.hasOwnProperty('categories')) {
                iIndexOfCategory = 1;
            }
            if (options.dataViews[0].categorical.hasOwnProperty('values')) {
                len = options.dataViews[0].categorical.values.length;
            } else {
                this.displayBasicRequirement(4);

                return;
            }
            if (dataViews[0].categorical.categories[0].values.length > 100) {
                this.displayBasicRequirement(5);

                return;
            }
            for (let index: number = 0; index < len; index++) {
                if (options.dataViews[0].categorical.values[index].source.roles.hasOwnProperty(Visual.sourceStringLiteral)) {
                    iIndexOfSource = 2;
                } else if (options.dataViews[0].categorical.values[index].source.roles
                    .hasOwnProperty(Visual.destinationStringLiteral)) {
                    iIndexOfDestination = 3;
                }
            }
            if (iIndexOfCategory === -1) {
                this.displayBasicRequirement(1);

                return;
            } else if (iIndexOfSource === -1) {
                this.displayBasicRequirement(2);

                return;
            } else if (iIndexOfDestination === -1) {
                this.displayBasicRequirement(3);

                return;
            }
            const dataPoints: IVisualDataPoint[] = [];
            let sourceName: string;
            let destinationName: string;
            let sourceSum: number = 0;
            let destSum: number = 0;
            let categorical: DataViewCategorical;
            categorical = dataViews[0].categorical;
            let category: DataViewCategoryColumn;
            category = categorical.categories[0];
            let dataValue: DataViewValueColumn;
            dataValue = categorical.values[0];

            let colorPalette: ISandboxExtendedColorPalette;
            colorPalette = host.colorPalette;
            let objects: DataViewObjects;
            objects = dataViews[0].metadata.objects;
            let length: number;
            length = Math.max(category.values.length, dataValue.values.length);
            Visual.legendDataPoints = [];
            for (let i: number = 0; i < length; i++) {
                let defaultColor: Fill;
                defaultColor = {
                    solid: {
                        color: colorPalette.getColor(category.values[i].toString()).value
                    }
                };

                let dataPoint: IVisualDataPoint;
                dataPoint = {
                    category: '',
                    source: null,
                    destination: null,
                    color: '',
                    selectionId: null,
                    dataPercentageSource: null,
                    dataPercentageDestination: null,
                    tooltipData: []
                };
                for (let cat1: number = 0; cat1 < dataViews[0].categorical.categories.length; cat1++) {
                    let dataView: DataView;
                    dataView = dataViews[0];
                    if (dataView.categorical.categories[cat1].source.roles.hasOwnProperty('category')) {
                        dataPoint.category = dataView.categorical.categories[cat1].values[i] ?
                            (dataView.categorical.categories[cat1].values[i].toString()) : '';
                    }
                    let tooltipDataPoint: ITooltipDataPoints;
                    tooltipDataPoint = {
                        formatter: '',
                        name: dataView.categorical.categories[cat1].source.displayName,
                        value: dataView.categorical.categories[cat1].values[i] !== null ?
                            (dataView.categorical.categories[cat1].values[i].toString()) : ''
                    };
                    dataPoint.tooltipData.push(tooltipDataPoint);
                }

                for (let k: number = 0; k < dataViews[0].categorical.values.length; k++) {
                    let dataView: DataView;
                    dataView = dataViews[0];
                    let dataVal: PrimitiveValue;
                    dataVal = dataView.categorical.values[k].values[i];
                    dataVal = dataVal === null ? 0 : dataVal;
                    let colName: string;
                    colName = dataView.categorical.values[k].source.displayName ?
                        dataView.categorical.values[k].source.displayName.toString() : '';
                    if (dataView.categorical.values[k].source.roles.hasOwnProperty(Visual.sourceStringLiteral)) {
                        sourceName = colName;
                        sourceSum += Number(dataVal);
                        dataPoint.source = Number(dataVal);
                    }
                    if (dataView.categorical.values[k].source.roles.hasOwnProperty(Visual.destinationStringLiteral)) {
                        destinationName = colName;
                        destSum += Number(dataVal);
                        dataPoint.destination = Number(dataVal);
                    }
                    let tooltipDataPoint: ITooltipDataPoints;
                    tooltipDataPoint = {
                        formatter: dataView.categorical.values[k].source.format ?
                            dataView.categorical.values[k].source.format : ValueFormatter.DefaultNumericFormat,
                        name: colName,
                        value: dataVal !== null ? dataVal.toString() : ''
                    };
                    dataPoint.tooltipData.push(tooltipDataPoint);
                }
                dataPoint.color = getCategoricalObjectValue<Fill>(category, i, 'colorSettings', 'color', defaultColor).solid.color;
                dataPoint.selectionId = host.createSelectionIdBuilder()
                    .withCategory(category, i)
                    .createSelectionId();
                const legendDataPoint: ILegendDataPoint = {
                    category: dataPoint.category as string,
                    color: getCategoricalObjectValue<Fill>(category, i, 'colorSettings', 'color', defaultColor).solid.color,
                    identity: host.createSelectionIdBuilder()
                        .withCategory(category, i)
                        .createSelectionId(),
                    selected: false
                };
                Visual.legendDataPoints.push(legendDataPoint);
                dataPoints.push(dataPoint);
            }
            // tslint:disable-next-line:no-any
            const getSum: any = function (total: any, val: any): any {
                return total + val;
            };

            return {
                dataPoints: dataPoints,
                categoryName: categorical.categories[0].source.displayName,
                sourceName: sourceName,
                destinationName: destinationName,
                measureName: 'measureName',
                sumOfSource: sourceSum,
                sumOfDestination: destSum,
                fontColor: Visual.conversionSettings.fontColor,
                fontSize: Visual.conversionSettings.fontSize
            };
        }
        private displayBasicRequirement(iStatus: number): void {
            d3.select('.categoryLabelContainer').selectAll('*').empty();
            d3.select('.visualContainer').selectAll('*').empty();
            d3.select('.mainContainer').selectAll('*').empty();
            d3.select(this.target).insert('div', ':first-child')
                .attr('id', 'textToDisplay');
            d3.select('#textToDisplay').style({
                height: '100%',
                width: '100%'
            });
            switch (iStatus) {
                case 1:
                    document.getElementById('textToDisplay').textContent = `Please select 'Category'`;
                    break;
                case 2:
                    document.getElementById('textToDisplay').textContent = `Please select 'Source'`;
                    break;
                case 3:
                    document.getElementById('textToDisplay').textContent = `Please select 'Destination'`;
                    break;
                case 4:
                    document.getElementById('textToDisplay').textContent = `Please select 'Source' and 'Destination'`;
                    break;
                case 5:
                    document.getElementById('textToDisplay').textContent = `Data Limit exceeded`;
                    break;
                default:
                    break;
            }
        }

        // tslint:disable-next-line:cyclomatic-complexity
        public update(options: VisualUpdateOptions): void {
            const $this: this = this;
            d3.select('#textToDisplay').remove();
            // tslint:disable-next-line:no-any
            const dataView: DataView = this.dataView = options.dataViews && options.dataViews[0]
                ? options.dataViews[0]
                : null;
            const categoryLabelSettings: ICategoryLabelSettings = Visual.categoryLabelSettings = getCategoryLabelSettings(dataView);
            const separatorSettings: ISeparatorSettings = Visual.separatorSettings = getSeparatorSettings(dataView);
            const conversionSettings: IConversionSettings = Visual.conversionSettings = getConversionSettings(dataView);
            const detailLabelSettings: IDetailLabelSettings = Visual.detailLabelSettings = getDetailLabelSettings(dataView);
            const rotationSetting: IRotationSettings = this.rotationSettings = getRotationSettings(dataView);
            const animationSettings: IAnimationSettings = this.animationSettings = getAnimationSettings(dataView);
            const orientationSettings: IOrientationSettings = this.orientationSettings = getOrientationSettings(dataView);
            const gradientSettings: IGradientSettings = Visual.gradientSettings = getGradientSettings(dataView);
            const legendSettings: ILegendConfig = this.legendSetting = getLegendSettings(dataView);
            const viewModel: IVisualViewModel = $this.visualModel = $this.VisualTransform(options, $this.host);
            let viewportWidth: number = options.viewport.width;
            let viewportHeight: number = options.viewport.height;
            const summaryLabelColor: string = viewModel.fontColor;
            const summaryLabelSize: number = viewModel.fontSize;
            const measureName: string = viewModel.measureName;
            const isEllipses: boolean = true;
            const sourceLabelRelativeHeight: number = 0.053;
            this.viewport = options.viewport;
            Visual.dataLabelFlip = false;
            // Repainting all the elements
            d3.selectAll('.funnel').remove();
            d3.selectAll('.conversionContainer').remove();
            d3.select('.conversionMsgContainer').remove();
            d3.select('.measuresContainer').remove();
            d3.selectAll('.labelValue').remove();
            d3.selectAll('.separatorLine').remove();
            d3
                .selectAll('.legend #legendGroup .legendItem, .legend #legendGroup .legendTitle')
                .remove();
            d3.selectAll(Visual.dotLiteral + Visual.measureLabelLiteral).remove();
            d3.selectAll(Visual.dotLiteral + Visual.measureLabelDestLiteral).remove();

            this.mainContainer.style('margin-top', `${0}px`)
                .style('margin-bottom', `${0}px`)
                .style('margin-left', `${0}px`)
                .style('margin-right', `${0}px`)
                .attr('width', options.viewport.width)
                .attr('height', options.viewport.height);
            d3.select('.visualContainer').style('margin-top', `${0}px`)
                .style('margin-bottom', `${0}px`)
                .style('margin-left', `${0}px`)
                .style('margin-right', `${0}px`);
            let legendWidth: number = 0;
            let legendHeight: number = 0;
            const legendContainer: d3.Selection<SVGElement> = d3.select('.legend');
            const legendGroupContainer: d3.Selection<SVGElement> = d3.select('.legend #legendGroup');
            if (legendSettings.show) {
                this.renderLegend(dataView, legendSettings, true);
                legendWidth = parseFloat(legendContainer.attr('width'));
                legendHeight = parseFloat(legendContainer.attr('height'));
                const legendOrient: LegendPosition = Visual.legend.getOrientation();
                switch (legendOrient) {
                    case 0:
                        viewportHeight -= legendHeight;
                        this.mainContainer.style('margin-top', `${legendHeight}px`);
                        this.mainContainer.attr('height', viewportHeight + Visual.pxLiteral);
                        break;
                    case 1:
                        viewportHeight -= legendHeight;
                        this.mainContainer.style('margin-bottom', `${legendHeight}px`);
                        this.mainContainer.attr('height', viewportHeight + Visual.pxLiteral);
                        break;
                    case 2:
                        viewportWidth -= legendWidth;
                        this.mainContainer.style('margin-right', `${legendWidth}px`);
                        this.mainContainer.attr('width', viewportWidth + Visual.pxLiteral);
                        break;
                    case 3:
                        viewportWidth -= legendWidth;
                        this.mainContainer.style('margin-left', `${legendWidth}px`);
                        this.mainContainer.attr('width', viewportWidth + Visual.pxLiteral);
                        break;
                    default:
                        break;
                }
            }

            let ratio: number = 0.9;
            if (categoryLabelSettings.show) {
                ratio = 0.8;
                Visual.widthCategoryLabel = Math.min(Visual.getCategoryLabelWidth(viewModel) + 5, viewportWidth * (1 - ratio));
                Visual.heightCategoryLabel = Visual.getCategoryLabelHeight(viewModel);
            }

            if (categoryLabelSettings.show && !rotationSetting.show) {
                viewportWidth -= Visual.widthCategoryLabel;
                d3.select('.visualContainer')
                    .style('margin-left', Visual.widthCategoryLabel);
            }

            if (categoryLabelSettings.show && rotationSetting.show) {
                viewportHeight -= Visual.heightCategoryLabel;
                d3.select('.visualContainer')
                    .style('margin-top', Visual.heightCategoryLabel);
            }
            d3.select('.visualContainer')
                .attr('width', viewportWidth)
                .attr('height', viewportHeight);

            const funnelWidth: number = viewportWidth;
            const funnelHeight: number = viewportHeight;
            const maxBaseHeight: number = funnelHeight * ratio;
            const maxBaseWidth: number = funnelWidth * ratio;

            let w: string;
            let h: string;

            if (!this.rotationSettings.show) {
                w = `${Visual.widthCategoryLabel}px`;
                h = '100%';
                Visual.flag = 0;
            } else {
                h = `${Visual.heightCategoryLabel + 5}px`;
                w = '100%';
                Visual.flag = 1;
            }

            this.categoryLabelDiv.style({
                width: w,
                height: h,
                top: '0px',
                position: 'absolute'
            });

            Visual.cX = viewportWidth / 2;
            Visual.cY = viewportHeight / 2;
            const triData: d3.selection.Update<IVisualDataPoint> = $this.visualCont.selectAll('.funnel')
                .data(viewModel.dataPoints);

            let maxConversionBoxWidth: number;
            let maxConversionBoxHeight: number;
            let minConversionBoxWidth: number;
            let minConversionBoxHeight: number;
            let conversionBoxWidth: number;
            let conversionBoxHeight: number;

            const noOfFunnels: number = (triData && triData[0]) ? triData[0].length : 0;

            maxConversionBoxWidth = 45;
            maxConversionBoxHeight = 35;
            minConversionBoxWidth = 15;
            minConversionBoxHeight = 15;

            conversionBoxWidth = Math.min(maxBaseWidth * Visual.MINCONVERSIONBOXWIDTH, maxConversionBoxWidth);
            conversionBoxHeight = Math.min(maxBaseHeight * Visual.MINCONVERSIONBOXHEIGHT, maxConversionBoxHeight);

            conversionBoxWidth = Visual.conversionBoxWidth = Math.max(conversionBoxWidth, minConversionBoxWidth);
            conversionBoxHeight = Math.max(conversionBoxHeight, minConversionBoxHeight);

            if (Visual.flag === 0) {
                conversionBoxWidth = Math.min(conversionBoxWidth, maxBaseWidth * 0.5 / noOfFunnels);
            } else {
                conversionBoxHeight = Math.min(conversionBoxHeight, maxBaseHeight * 0.7 / noOfFunnels);
            }

            let detailLabelXAxis: number;
            let detailLabelXAxisSrc: number;
            let conversionXAxis: number;

            // tslint:disable-next-line:no-any
            const conversionValues: any[] = [];
            // tslint:disable-next-line:no-any
            const sourceCumulative: any[] = [];
            // tslint:disable-next-line:no-any
            const destinationCumulative: any[] = [];
            let startXLabel: number = 0;
            let isLabelShrinked: boolean;
            sourceCumulative[0] = viewModel.dataPoints[0].source;
            destinationCumulative[0] = viewModel.dataPoints[0].destination;

            for (let idx: number = 1; idx <= viewModel.dataPoints.length - 1; idx++) {
                sourceCumulative[idx] = sourceCumulative[idx - 1] + viewModel.dataPoints[idx].source;
                destinationCumulative[idx] = destinationCumulative[idx - 1] + viewModel.dataPoints[idx].destination;
            }

            $this.mainContainer.attr({
                width: viewportWidth,
                height: viewportHeight
            }).style({
                position: 'absolute'
            });

            const colorPalette: IColorPalette = this.host.colorPalette;
            // on enter
            triData.enter()
                .append('g')
                .classed('funnel', true)
                .each(function (d: IVisualDataPoint, i: number): void {
                    // tslint:disable-next-line:no-any
                    const $$this: any = d3.select(this);
                    let catVar: string = d.category.toString();
                    catVar = catVar.replace(/\s/g, '');
                    catVar = catVar.replace(/[^a-zA-Z ]/g, '');

                    if (!orientationSettings.show) {
                        $$this.append('path')
                            .classed(catVar + Visual.spaceLiteral + Visual.upperTriLiteral, true);
                        $$this.append('path')
                            .classed(catVar + Visual.spaceLiteral + Visual.lowerTriLiteral, true);
                    } else {
                        $$this.append('polyline')
                            .classed(catVar + Visual.spaceLiteral + Visual.upperTriLiteral, true);
                        $$this.append('polyline')
                            .classed(catVar + Visual.spaceLiteral + Visual.lowerTriLiteral, true);
                    }
                    if (Visual.separatorSettings.show) {
                        if ((noOfFunnels - 1) !== i) {
                            $$this.append('path')
                                .classed('separatorUpLine separatorLine', true);
                            $$this.append('path')
                                .classed('separatorDownLine separatorLine', true);
                        }
                    }
                });
            // on update
            let x: number;
            let y: number;
            let xDest: number;
            let yDest: number;
            let startVal: number = 0;
            let startFlagDest: number = 0;
            let setstartXLabel: boolean = false;
            const xArr: number[] = [];
            const xArrDest: number[] = [];
            const yArr: number[] = [];
            const yArrDest: number[] = [];
            // tslint:disable-next-line:no-any
            let conversionValue: any;
            // tslint:disable-next-line:no-any
            let dataLevel: any;
            // tslint:disable-next-line:no-any
            let dataValue: any;
            // tslint:disable-next-line:no-any
            let dataPercentage: any;

            let baseUpTri: number;
            let startUpTriX: number;
            let baseDownTri: number;
            let startDownTriX: number;
            let base: number = 0;
            let width: number = 0;
            let baseDest: number = 0;
            let widthDest: number = 0;

            let maxWidth: number = maxBaseWidth;
            let maxHeight: number = maxBaseHeight;
            if (maxWidth < maxBaseWidth * Visual.MAXWIDTHRATIO) {
                maxWidth = maxBaseWidth * Visual.MAXWIDTHRATIO;
            }
            if (maxHeight < maxBaseHeight * Visual.MAXHEIGHTRATIO) {
                maxHeight = maxBaseHeight * Visual.MAXHEIGHTRATIO;
            }

            let strokeStyle: string = separatorSettings.lineType;

            switch (strokeStyle) {
                case 'dashed':
                    strokeStyle = '5 ,4';
                    break;
                case 'dotted':
                    strokeStyle = '2 ,1';
                    break;
                default:
                    strokeStyle = 'none';
            }
            const displayValue: string = conversionSettings.displayValue;
            if (orientationSettings.show) {

                if (orientationSettings.showFlip) {
                    Visual.dataLabelFlip = true;
                }

                triData.each(function (d: IVisualDataPoint, i: number): void {
                    let catVar: string = d.category.toString();
                    catVar = catVar.replace(/\s/g, '');
                    catVar = catVar.replace(/[^a-zA-Z ]/g, '');
                    // tslint:disable-next-line:no-any
                    const $$this: any = d3.select(this);
                    $$this.select(Visual.dotLiteral + catVar + Visual.dotLiteral + Visual.upperTriLiteral)
                        .attr({
                            // tslint:disable-next-line:no-any
                            points: function (k: any): string {
                                yArr[i] = base;
                                xArr[i] = width;
                                if (Visual.flag === 0) {
                                    base = maxHeight / 2 * (sourceCumulative[i] / viewModel.sumOfSource);
                                    width = maxWidth * (sourceCumulative[i] / viewModel.sumOfSource) / 2;
                                    baseUpTri = base;
                                    startUpTriX = width;
                                    if ((noOfFunnels - 1) === i) {
                                        x = Visual.cX - width;
                                        y = Visual.cY - base;
                                    }
                                } else {
                                    base = maxHeight * (sourceCumulative[i] / viewModel.sumOfSource) / 2;
                                    width = maxWidth / 2 * (sourceCumulative[i] / viewModel.sumOfSource);
                                    baseUpTri = base;
                                    startUpTriX = width;
                                    if ((noOfFunnels - 1) === i) {
                                        x = Visual.cX - width;
                                        y = Visual.cY - base;
                                    }
                                }
                                dataValue = d.source;
                                dataPercentage = Math.round(d.source / viewModel.sumOfSource * 100) + Visual.percentageLiteral;
                                dataLevel = dataValue + Visual.spaceLiteral + Visual.openBracketLiteral
                                    + dataPercentage + Visual.closeBracketLiteral;
                                viewModel.dataPoints.forEach(function (cat: IVisualDataPoint): void {
                                    if (cat.category === d.category) {
                                        cat.dataPercentageSource = dataPercentage;
                                    }
                                });

                                return Visual.GetTriangleUpH(Visual.cX, Visual.cY, base, width, Visual.flag, xArr[i], yArr[i]);
                            },
                            fill: d.color
                        });

                    const labelTextVisibility: {
                        visibility: string;
                        labelText: string;
                        xAxis: number;
                        yAxis: number;
                    } = Visual.findlabelTextAndVisibilitySrc(dataLevel, width, dataPercentage, baseUpTri,
                                                             dataValue, Visual.cX, options, isEllipses, Visual.cY, xArr[i],
                                                             yArr[i], funnelHeight, funnelWidth);

                    if (noOfFunnels - 1 === i) {
                        detailLabelXAxisSrc = labelTextVisibility.xAxis;
                    }

                    if (detailLabelSettings.show) {
                        let dy: number = 0.74;
                        if (orientationSettings.showFlip) {
                            dy = 0;
                        }
                        $$this.append('text')
                            .classed(Visual.textLabelLiteral, true)
                            .style('font-size', detailLabelSettings.fontSize + Visual.pxLiteral)
                            .style('font-family', categoryLabelSettings.fontFamily)
                            .style('fill', detailLabelSettings.color)
                            .style('visibility', labelTextVisibility.visibility)
                            .attr({
                                x: labelTextVisibility.xAxis,
                                y: labelTextVisibility.yAxis,
                                dy: `${dy}em`
                            })
                            .text(labelTextVisibility.labelText);

                        // tslint:disable-next-line:no-any
                        let labelGroups: any;
                        labelGroups = $$this.append('g')
                            .attr('class', 'snp_polyline')
                            .style('fill', 'none')
                            .style('stroke', 'grey')
                            .style('stroke-width', '1px')
                            .style('opacity', '0.8');

                        // tslint:disable-next-line:no-any
                        let line: any;
                        line = labelGroups.append('polyline')
                            // tslint:disable-next-line:no-any
                            .attr('points', function (): any {
                                let point: string;
                                if (Visual.dataLabelFlip) {
                                    if (Visual.flag === 0) {
                                        point = `${Visual.cX + (width + xArr[i]) / 2} , ${Visual.cY - (base + yArr[i]) / 2}
                                                 ${(Visual.cX + (width + xArr[i]) / 2) * 1.025} , ${Visual.cY - (base + yArr[i]) / 2}`;
                                    } else {
                                        point = `${Visual.cX - (width + xArr[i]) / 2} , ${Visual.cY - (base + yArr[i]) / 2}
                                         ${Visual.cX - (width + xArr[i]) / 2} , ${(Visual.cY - (base + yArr[i]) / 2) * 0.95}`;
                                    }
                                } else {
                                    if (Visual.flag === 0) {
                                        point = `${Visual.cX - (width + xArr[i]) / 2} , ${Visual.cY - (base + yArr[i]) / 2}
                                             ${(Visual.cX - (width + xArr[i]) / 2) * 0.95} , ${Visual.cY - (base + yArr[i]) / 2}`;
                                    } else {
                                        point = `${Visual.cX - (width + xArr[i]) / 2} , ${Visual.cY + (base + yArr[i]) / 2}
                                     ${Visual.cX - (width + xArr[i]) / 2} , ${(Visual.cY + (base + yArr[i]) / 2) * 1.05}`;
                                    }
                                }

                                return point;
                            })
                            .style('visibility', labelTextVisibility.visibility);
                    }

                    $$this.select(Visual.dotLiteral + catVar + Visual.dotLiteral + Visual.lowerTriLiteral)
                        .attr({
                            // tslint:disable-next-line:no-any
                            points: function (k: any): string {

                                yArrDest[i] = baseDest;
                                xArrDest[i] = widthDest;
                                if (Visual.flag === 0) {
                                    baseDest = maxHeight / 2 * (destinationCumulative[i] / viewModel.sumOfDestination);
                                    widthDest = maxWidth * (destinationCumulative[i] / viewModel.sumOfDestination) / 2;
                                    baseDownTri = baseDest;
                                    startDownTriX = widthDest;
                                    if ((noOfFunnels - 1) === i) {
                                        xDest = Visual.cX - width;
                                        yDest = Visual.cY + base - Visual.getCategoryLabelHeight(viewModel);
                                        startFlagDest++;
                                    }
                                } else {
                                    widthDest = maxWidth / 2 * (destinationCumulative[i] / viewModel.sumOfDestination);
                                    baseDest = maxHeight * (destinationCumulative[i] / viewModel.sumOfDestination) / 2;
                                    baseDownTri = baseDest;
                                    startDownTriX = widthDest;
                                    if ((noOfFunnels - 1) === i) {
                                        xDest = Visual.cX + widthDest * 0.7;
                                        yDest = Visual.cY - width;
                                        startFlagDest++;
                                    }
                                }
                                if (k.source === 0) {
                                    conversionValue = 0;
                                } else if (displayValue === 'percent') {
                                    conversionValue = k.destination / k.source * 100;
                                } else {
                                    conversionValue = Math.abs(k.source - k.destination);
                                }
                                if (conversionValue !== null) {
                                    conversionValue = parseFloat(Number(conversionValue).toFixed(0)).toString();
                                }
                                conversionValues.push({
                                    percentageBg: Visual.percentageBgLiteral + i,
                                    percentageValue: Visual.percentageValueLiteral + i,
                                    value: conversionValue,
                                    color: k.color,
                                    categoryName: k.category
                                });

                                dataValue = k.destination;
                                dataPercentage = k.destination / viewModel.sumOfDestination * 100;
                                if (dataPercentage !== null) {
                                    dataPercentage = Math.round(dataPercentage).toString() + Visual.percentageLiteral;
                                }
                                dataLevel = dataValue + Visual.spaceLiteral + Visual.openBracketLiteral
                                    + dataPercentage + Visual.closeBracketLiteral;
                                viewModel.dataPoints.forEach(function (ca: IVisualDataPoint): void {
                                    if (ca.category === k.category) {
                                        ca.dataPercentageDestination = dataPercentage;
                                    }
                                });

                                return Visual.GetTriangleDownH(Visual.cX, Visual.cY, baseDest, widthDest, Visual.flag,
                                                               xArrDest[i], yArrDest[i]);
                            },
                            fill: d.color
                        });

                    const minTextWidth: number = 100;
                    const labelTextVisibilityDest: {
                        visibility: string;
                        labelText: string;
                        xAxis: number;
                        yAxis: number;
                    } = Visual.findlabelTextAndVisibilityDestination(dataLevel, widthDest, dataPercentage, baseDownTri,
                                                                     dataValue, Visual.cX, options, isEllipses, Visual.cY,
                                                                     xArrDest[i], yArrDest[i], funnelHeight, funnelWidth);

                    if (noOfFunnels - 1 === i) {
                        detailLabelXAxis = labelTextVisibilityDest.xAxis;
                    }
                    if (detailLabelSettings.show) {
                        let dy: number = 0.74;
                        if (orientationSettings.showFlip) {
                            dy = 0;
                        }
                        $$this.append('text')
                            .classed(Visual.textLabelLiteral, true)
                            .style('font-size', detailLabelSettings.fontSize + Visual.pxLiteral)
                            .style('font-family', categoryLabelSettings.fontFamily)
                            .style('fill', detailLabelSettings.color)
                            .style('visibility', labelTextVisibilityDest.visibility)
                            .attr({
                                x: labelTextVisibilityDest.xAxis,
                                y: labelTextVisibilityDest.yAxis,
                                dy: `${dy}em`
                            })
                            .text(labelTextVisibilityDest.labelText);
                        // tslint:disable-next-line:no-any
                        let labelGroups: any;
                        labelGroups = $$this.append('g')
                            .attr('class', 'snp_polyline')
                            .style('fill', 'none')
                            .style('stroke', 'grey')
                            .style('stroke-width', '1px')
                            .style('opacity', '0.8');
                        // tslint:disable-next-line:no-any
                        let line: any;
                        line = labelGroups.append('polyline')
                            // tslint:disable-next-line:no-any
                            .attr('points', function (): any {
                                let points: string;

                                if (Visual.dataLabelFlip) {
                                    if (Visual.flag === 0) {
                                        points = `${Visual.cX + (widthDest + xArrDest[i]) / 2} ,
                                                  ${Visual.cY + (baseDest + yArrDest[i]) / 2}
                                                  ${((Visual.cX + (widthDest + xArrDest[i]) / 2)) * 1.025} ,
                                                   ${Visual.cY + (baseDest + yArrDest[i]) / 2}`;
                                    } else {
                                        points = `${Visual.cX + (widthDest + xArrDest[i]) / 2},
                                                  ${Visual.cY - (baseDest + yArrDest[i]) / 2}
                                                  ${(Visual.cX + (widthDest + xArrDest[i]) / 2)},
                                                  ${(Visual.cY - (baseDest + yArrDest[i]) / 2) * 0.95}`;
                                    }
                                } else {
                                    if (Visual.flag === 0) {
                                        points = `${Visual.cX - (widthDest + xArrDest[i]) / 2} ,
                                              ${Visual.cY + (baseDest + yArrDest[i]) / 2}
                                              ${((Visual.cX - (widthDest + xArrDest[i]) / 2)) * 0.95} ,
                                               ${Visual.cY + (baseDest + yArrDest[i]) / 2}`;
                                    } else {
                                        points = `${Visual.cX + (widthDest + xArrDest[i]) / 2},
                                              ${Visual.cY + (baseDest + yArrDest[i]) / 2}
                                              ${(Visual.cX + (widthDest + xArrDest[i]) / 2)},
                                              ${(Visual.cY + (baseDest + yArrDest[i]) / 2) * 1.05}`;
                                    }
                                }

                                return points;
                            })
                            .style('visibility', labelTextVisibilityDest.visibility);
                    }

                    if ((noOfFunnels - 1) !== i) {
                        $$this.select('.separatorUpLine')
                            .attr({
                                d: function (k: IVisualDataPoint): string {
                                    return Visual.GetSeparatorUpH(Visual.cX, Visual.cY, startUpTriX, width, baseUpTri);
                                },
                                'stroke-width': separatorSettings.strokeWidth,
                                'stroke-dasharray': strokeStyle,
                                stroke: separatorSettings.color
                            });
                        $$this.select('.separatorDownLine')
                            .attr({
                                d: function (k: IVisualDataPoint): string {
                                    return Visual.GetSeparatorDownH(Visual.cX, Visual.cY, startDownTriX, widthDest, baseDownTri);
                                },
                                fill: 'none',
                                'stroke-width': separatorSettings.strokeWidth,
                                'stroke-dasharray': strokeStyle,
                                stroke: separatorSettings.color
                            });
                    }

                    if (animationSettings.show) {
                        d3.select(Visual.dotLiteral + catVar + Visual.dotLiteral + Visual.upperTriLiteral)
                            .on('mouseover', function (): void {
                                d3.select(this)
                                    .transition()
                                    // tslint:disable-next-line:no-any
                                    .attr('points', function (k: any): string {
                                        if (Visual.flag === 0) {
                                            base = maxHeight / 2 * (sourceCumulative[i] / viewModel.sumOfSource);
                                            width = maxWidth * (sourceCumulative[i] / viewModel.sumOfSource) / 2;

                                            return Visual.GetTriangleUpH(Visual.cX, Visual.cY, base, width + 10,
                                                                         Visual.flag, xArr[i] + 10, yArr[i]);
                                        } else {
                                            base = maxHeight * (sourceCumulative[i] / viewModel.sumOfSource) / 2;
                                            width = maxWidth / 2 * (sourceCumulative[i] / viewModel.sumOfSource);

                                            return Visual.GetTriangleUpH(Visual.cX, Visual.cY, base + 10, width,
                                                                         Visual.flag, xArr[i], yArr[i] + 10);
                                        }

                                    });
                            })
                            .on('mouseout', function (): void {
                                d3.select(this)
                                    .transition()
                                    // tslint:disable-next-line:no-any
                                    .attr('points', function (k: any): string {

                                        if (Visual.flag === 0) {
                                            base = maxHeight / 2 * (sourceCumulative[i] / viewModel.sumOfSource);
                                            width = maxWidth * (sourceCumulative[i] / viewModel.sumOfSource) / 2;
                                        } else {
                                            base = maxHeight * (sourceCumulative[i] / viewModel.sumOfSource) / 2;
                                            width = maxWidth / 2 * (sourceCumulative[i] / viewModel.sumOfSource);
                                        }

                                        return Visual.GetTriangleUpH(Visual.cX, Visual.cY, base, width, Visual.flag, xArr[i], yArr[i]);
                                    });
                            });

                        d3.select(Visual.dotLiteral + catVar + Visual.dotLiteral + Visual.lowerTriLiteral)
                            .on('mouseover', function (): void {
                                d3.select(this)
                                    .transition()
                                    // tslint:disable-next-line:no-any
                                    .attr('points', function (k: any): string {
                                        if (Visual.flag === 0) {
                                            baseDest = maxHeight / 2 * (destinationCumulative[i] / viewModel.sumOfDestination);
                                            widthDest = maxWidth * (destinationCumulative[i] / viewModel.sumOfDestination) / 2;

                                            return Visual.GetTriangleDownH(Visual.cX, Visual.cY, baseDest, widthDest + 10,
                                                                           Visual.flag, xArrDest[i] + 10, yArrDest[i]);
                                        } else {
                                            widthDest = maxWidth / 2 * (destinationCumulative[i] / viewModel.sumOfDestination);
                                            baseDest = maxHeight * (destinationCumulative[i] / viewModel.sumOfDestination) / 2;

                                            return Visual.GetTriangleDownH(Visual.cX, Visual.cY, baseDest + 10, widthDest,
                                                                           Visual.flag, xArrDest[i], yArrDest[i] + 10);
                                        }
                                    });
                            })
                            .on('mouseout', function (): void {
                                d3.select(this)
                                    .transition()
                                    // tslint:disable-next-line:no-any
                                    .attr('points', function (k: any): string {
                                        if (Visual.flag === 0) {
                                            baseDest = maxHeight / 2 * (destinationCumulative[i] / viewModel.sumOfDestination);
                                            widthDest = maxWidth * (destinationCumulative[i] / viewModel.sumOfDestination) / 2;
                                        } else {
                                            widthDest = maxWidth / 2 * (destinationCumulative[i] / viewModel.sumOfDestination);
                                            baseDest = maxHeight * (destinationCumulative[i] / viewModel.sumOfDestination) / 2;
                                        }

                                        return Visual.GetTriangleDownH(Visual.cX, Visual.cY, baseDest, widthDest,
                                                                       Visual.flag, xArrDest[i], yArrDest[i]);
                                    });
                            });
                    }

                });
            }
            this.addTriangleSelection(conversionSettings.transparency);

            if (!orientationSettings.show) {
                let baseD: number = 0;
                base = 0;
                let startX: number = (viewportHeight - maxBaseHeight) / 2;
                let startDestX: number = (viewportHeight - maxBaseHeight) / 2;
                if (Visual.flag === 0) {
                    startX = (viewportWidth - maxBaseWidth) / 2;
                    startDestX = (viewportWidth - maxBaseWidth) / 2;
                }
                triData.each(function (d: IVisualDataPoint, i: number): void {
                    // tslint:disable-next-line:no-any
                    const $$this: any = d3.select(this);

                    let catVar: string = d.category.toString();
                    catVar = catVar.replace(/\s/g, '');
                    catVar = catVar.replace(/[^a-zA-Z ]/g, '');
                    $$this.select(Visual.dotLiteral + catVar + Visual.dotLiteral + Visual.upperTriLiteral)
                        .attr({
                            // tslint:disable-next-line:no-any
                            d: function (k: any): string {
                                if (Visual.flag === 0) {
                                    startX += base;
                                    base = maxWidth * (d.source / viewModel.sumOfSource);
                                    startUpTriX = startX;
                                    baseUpTri = base;
                                    width = maxHeight * 0.45;
                                    xArr[i] = startX;
                                    if (startVal === 0) {
                                        x = startX;
                                        y = Visual.cY - width;
                                        startVal++;
                                    }
                                } else {
                                    startX += base;
                                    base = maxHeight * (d.source / viewModel.sumOfSource);
                                    startUpTriX = startX;
                                    baseUpTri = base;
                                    width = maxWidth * 0.45;
                                    xArr[i] = startX;

                                    if (startVal === 0) {
                                        x = Visual.cX - width;
                                        y = startX;
                                        startVal++;
                                    }
                                }
                                dataValue = d.source;
                                dataPercentage = Math.round(d.source / viewModel.sumOfSource * 100) + Visual.percentageLiteral;
                                dataLevel = dataValue + Visual.spaceLiteral + Visual.openBracketLiteral
                                    + dataPercentage + Visual.closeBracketLiteral;
                                viewModel.dataPoints.forEach(function (cat: IVisualDataPoint): void {
                                    if (cat.category === d.category) {
                                        cat.dataPercentageSource = dataPercentage;
                                    }
                                });

                                return Visual.GetTriangleUpPath(Visual.cX, Visual.cY, startX, width, base, Visual.flag);
                            },
                            fill: d.color
                        });

                    if (i === 0) {
                        detailLabelXAxisSrc = startX;
                    }

                    const labelTextVisibility: {
                        visibility: string;
                        labelText: string;
                        xAxis: number;
                        yAxis: number;
                    } = Visual.findlabetTextAndVisibilitySource(dataLevel, startUpTriX, dataPercentage, baseUpTri,
                                                                dataValue, Visual.cX, options, isEllipses, Visual.cY,
                                                                funnelWidth, funnelHeight, maxWidth, maxHeight);

                    if (detailLabelSettings.show) {
                        $$this.append('text')
                            .classed(Visual.textLabelLiteral, true)
                            .style('font-size', detailLabelSettings.fontSize + Visual.pxLiteral)
                            .style('font-family', categoryLabelSettings.fontFamily)
                            .style('fill', detailLabelSettings.color)
                            .style('visibility', labelTextVisibility.visibility)
                            .attr({
                                x: labelTextVisibility.xAxis,
                                y: labelTextVisibility.yAxis
                            })
                            .text(labelTextVisibility.labelText);

                        // tslint:disable-next-line:no-any
                        let labelGroups: any;
                        labelGroups = $$this.append('g')
                            .attr('class', 'snp_polyline')
                            .style('fill', 'none')
                            .style('stroke', 'grey')
                            .style('stroke-width', '1px')
                            .style('opacity', '0.8');

                        // tslint:disable-next-line:no-any
                        let line: any;
                        line = labelGroups.append('polyline')
                            // tslint:disable-next-line:no-any
                            .attr('points', function (): any {
                                let points: string;
                                if (Visual.flag === 0) {
                                    points = `${(startUpTriX + startUpTriX + baseUpTri) / 2},${Visual.cY - maxHeight * 0.45}
                                         ${(startUpTriX + startUpTriX + baseUpTri) / 2} , ${Visual.cY - maxHeight * 0.475}`;
                                } else {
                                    points = `${Visual.cX - maxWidth * 0.45}  , ${(startUpTriX + startUpTriX + baseUpTri) / 2}
                                           ${(Visual.cX - maxWidth * 0.475)} , ${(startUpTriX + startUpTriX + baseUpTri) / 2}`;
                                }

                                return points;
                            })
                            .style('visibility', labelTextVisibility.visibility);
                    }

                    const labelText: string = labelTextVisibility.labelText;
                    let height: number = 0;

                    $$this.select(Visual.dotLiteral + catVar + Visual.dotLiteral + Visual.lowerTriLiteral)
                        .attr({
                            // tslint:disable-next-line:no-any
                            d: function (k: any): string {
                                if (Visual.flag === 1) {
                                    startDestX += baseD;
                                    baseD = maxHeight * (k.destination / viewModel.sumOfDestination);
                                    baseDownTri = baseD;
                                    startDownTriX = startDestX;
                                    height = maxWidth * 0.45;
                                    xArrDest[i] = startDestX;
                                    if (startFlagDest === 0) {
                                        xDest = Visual.cX + height * 0.7;
                                        yDest = startDestX;
                                        startFlagDest++;
                                    }
                                } else {
                                    startDestX += baseD;
                                    baseD = maxWidth * (k.destination / viewModel.sumOfDestination);
                                    startDownTriX = startDestX;
                                    baseDownTri = baseD;
                                    height = maxHeight * 0.45;
                                    xArrDest[i] = startDestX;
                                    if (startFlagDest === 0) {
                                        xDest = startDestX;
                                        yDest = Visual.cY + height - Visual.getCategoryLabelHeight(viewModel);
                                        startFlagDest++;
                                    }
                                }
                                if (k.source === 0) {
                                    conversionValue = 0;
                                } else if (displayValue === 'percent') {
                                    conversionValue = k.destination / k.source * 100;
                                } else {
                                    conversionValue = Math.abs(k.source - k.destination);
                                }
                                if (conversionValue !== null) {
                                    conversionValue = parseFloat(Number(conversionValue).toFixed(0)).toString();
                                }
                                conversionValues.push({
                                    percentageBg: Visual.percentageBgLiteral + i,
                                    percentageValue: Visual.percentageValueLiteral + i,
                                    value: conversionValue,
                                    color: k.color,
                                    categoryName: k.category
                                });

                                dataValue = k.destination;
                                dataPercentage = k.destination / viewModel.sumOfDestination * 100;
                                if (dataPercentage !== null) {
                                    dataPercentage = Math.round(dataPercentage).toString() + Visual.percentageLiteral;
                                }
                                dataLevel = dataValue + Visual.spaceLiteral + Visual.openBracketLiteral
                                    + dataPercentage + Visual.closeBracketLiteral;
                                viewModel.dataPoints.forEach(function (ca: IVisualDataPoint): void {
                                    if (ca.category === k.category) {
                                        ca.dataPercentageDestination = dataPercentage;
                                    }
                                });

                                return Visual.GetTriangleDownPath(Visual.cX, Visual.cY, startDestX, height, baseD, Visual.flag);
                            },
                            fill: d.color
                        });

                    if (i === 0) {
                        detailLabelXAxis = startX;
                    }

                    const minTextWidth: number = 100;
                    const labelTextVisibilityDest: {
                        visibility: string;
                        labelText: string;
                        xAxis: number;
                        yAxis: number;
                    } = Visual.findlabelTextAndVisibilityDest(dataLevel, startDownTriX,
                                                              dataPercentage, baseDownTri, options, dataValue, Visual.cX, Visual.cY,
                                                              funnelWidth, funnelHeight, maxWidth, maxHeight);

                    if (detailLabelSettings.show) {
                        $$this.append('text')
                            .classed(Visual.textLabelLiteral, true)
                            .style('font-size', detailLabelSettings.fontSize + Visual.pxLiteral)
                            .style('font-family', categoryLabelSettings.fontFamily)
                            .style('fill', detailLabelSettings.color)
                            .style('visibility', labelTextVisibilityDest.visibility)
                            .attr({
                                x: labelTextVisibilityDest.xAxis,
                                y: labelTextVisibilityDest.yAxis,
                                dy: '0.74em'
                            })
                            .text(labelTextVisibilityDest.labelText);
                        // tslint:disable-next-line:no-any
                        let labelGroups: any;
                        labelGroups = $$this.append('g')
                            .attr('class', 'snp_polyline')
                            .style('fill', 'none')
                            .style('stroke', 'grey')
                            .style('stroke-width', '1px')
                            .style('opacity', '0.8');

                        // tslint:disable-next-line:no-any
                        let line: any;
                        line = labelGroups.append('polyline')
                            // tslint:disable-next-line:no-any
                            .attr('points', function (): any {
                                let points: string;
                                if (Visual.flag === 0) {
                                    points = `${(startDownTriX + startDownTriX + baseDownTri) / 2}  ,
                                        ${(Visual.cY + maxHeight * 0.45)}
                                        ${(startDownTriX + startDownTriX + baseDownTri) / 2} , ${(Visual.cY + maxHeight * 0.475)}`;
                                } else {
                                    points = `${Visual.cX + maxWidth * 0.45} , ${(startDownTriX + startDownTriX + baseDownTri) / 2}
                                               ${Visual.cX + maxWidth * 0.475}  ,
                                                ${(startDownTriX + startDownTriX + baseDownTri) / 2}`;
                                }

                                return points;
                            })
                            .style('visibility', labelTextVisibilityDest.visibility);
                    }
                    if ((noOfFunnels - 1) !== i) {
                        $$this.select('.separatorUpLine')
                            .attr({
                                d: function (k: IVisualDataPoint): string {
                                    return Visual.GetSeparatorUpPath(Visual.cX, Visual.cY, startUpTriX, width, baseUpTri);
                                },
                                'stroke-width': separatorSettings.strokeWidth,
                                'stroke-dasharray': strokeStyle,
                                stroke: separatorSettings.color

                            });

                        $$this.select('.separatorDownLine')
                            .attr({
                                d: function (k: IVisualDataPoint): string {
                                    return Visual.GetSeparatorDownPath(Visual.cX, Visual.cY, startDownTriX, height, baseDownTri);
                                },
                                fill: 'none',
                                'stroke-width': separatorSettings.strokeWidth,
                                'stroke-dasharray': strokeStyle,
                                stroke: separatorSettings.color
                            });
                    }

                    if (animationSettings.show) {
                        d3.select(Visual.dotLiteral + catVar + Visual.dotLiteral + Visual.upperTriLiteral)
                            .on('mouseover', function (): void {
                                d3.select(this)
                                    .transition()
                                    // tslint:disable-next-line:no-any
                                    .attr('d', function (k: any): string {
                                        if (Visual.flag === 0) {
                                            base = maxWidth * (k.source / viewModel.sumOfSource);
                                            width = maxHeight * 0.45;
                                        } else {
                                            base = maxHeight * (k.source / viewModel.sumOfSource);
                                            width = maxWidth * 0.45;
                                        }

                                        return Visual.GetTriangleUpPath(Visual.cX, Visual.cY, xArr[i], width + 10, base, Visual.flag);
                                    });
                            })
                            .on('mouseout', function (): void {
                                d3.select(this)
                                    .transition()
                                    // tslint:disable-next-line:no-any
                                    .attr('d', function (k: any): string {
                                        if (Visual.flag === 0) {
                                            base = maxWidth * (k.source / viewModel.sumOfSource);
                                            width = maxHeight * 0.45;
                                        } else {
                                            base = maxHeight * (k.source / viewModel.sumOfSource);
                                            width = maxWidth * 0.45;
                                        }

                                        return Visual.GetTriangleUpPath(Visual.cX, Visual.cY, xArr[i], width, base, Visual.flag);
                                    });
                            });

                        d3.select(Visual.dotLiteral + catVar + Visual.dotLiteral + Visual.lowerTriLiteral)
                            .on('mouseover', function (): void {
                                d3.select(this)
                                    .transition()
                                    // tslint:disable-next-line:no-any
                                    .attr('d', function (k: any): string {
                                        if (Visual.flag === 1) {
                                            startDestX += baseD;
                                            baseD = maxHeight * (k.destination / viewModel.sumOfDestination);
                                            height = maxWidth * 0.45;
                                        } else {
                                            startDestX += baseD;
                                            baseD = maxWidth * (k.destination / viewModel.sumOfDestination);
                                            height = maxHeight * 0.45;
                                        }

                                        return Visual.GetTriangleDownPath(Visual.cX, Visual.cY, xArrDest[i],
                                                                          height + 10, baseD, Visual.flag);
                                    });
                            })
                            .on('mouseout', function (): void {

                                d3.select(this)
                                    .transition()
                                    // tslint:disable-next-line:no-any
                                    .attr('d', function (k: any): string {
                                        if (Visual.flag === 1) {
                                            baseD = maxHeight * (k.destination / viewModel.sumOfDestination);
                                            height = maxWidth * 0.45;
                                        } else {
                                            baseD = maxWidth * (k.destination / viewModel.sumOfDestination);
                                            height = maxHeight * 0.45;
                                        }

                                        return Visual.GetTriangleDownPath(Visual.cX, Visual.cY, xArrDest[i], height, baseD, Visual.flag);
                                    });
                            });
                    }
                });
            }

            if (conversionSettings.show) {
                triData.enter()
                    .append('g')
                    .classed('conversionContainer', true)
                    .each(function (d: IVisualDataPoint, i: number): void {
                        // tslint:disable-next-line:no-any
                        const $$this: any = d3.select(this);
                        let conVar: string = d.category.toString();
                        conVar = conVar.replace(/\s/g, '');
                        conVar = conVar.replace(/[^a-zA-Z ]/g, '');
                        $$this.append('rect')
                            .classed(conVar + Visual.spaceLiteral + Visual.percentageBgLiteral, true);
                        $$this.append('text')
                            .classed(Visual.conversionValueLiteral + Visual.spaceLiteral + Visual.percentageValueLiteral + i, true);
                    });

                triData.each(function (d: IVisualDataPoint, i: number): void {
                    // tslint:disable-next-line:no-any
                    let conversionPercent: any;

                    if (viewModel.sumOfSource < viewModel.sumOfDestination) {
                        if (Visual.flag === 0) {
                            maxWidth = maxBaseWidth * Visual.MAXWIDTHRATIO;
                        } else {
                            maxHeight = maxBaseHeight * Visual.MAXHEIGHTRATIO;
                        }
                    }
                    let visibility: string = 'visible';

                    let conVar: string = d.category.toString();
                    conVar = conVar.replace(/\s/g, '');
                    conVar = conVar.replace(/[^a-zA-Z ]/g, '');
                    const opacity: number = 100 - conversionSettings.transparency;
                    if (Visual.flag === 1) {
                        d3.select(Visual.dotLiteral + conVar + Visual.dotLiteral + Visual.percentageBgLiteral)
                            .attr({
                                y: Visual.cY + (i * conversionBoxHeight) - (noOfFunnels * conversionBoxHeight) / 2,
                                x: Visual.cX - (conversionBoxWidth / 2),
                                width: conversionBoxWidth,
                                height: conversionBoxHeight,
                                fill: d.color
                            })
                            .style({
                                opacity: opacity / 100
                            });
                    } else {
                        d3.select(Visual.dotLiteral + conVar + Visual.dotLiteral + Visual.percentageBgLiteral)
                            .attr({
                                x: Visual.cX + (i * conversionBoxWidth) - (noOfFunnels * conversionBoxWidth) / 2,
                                y: Visual.cY - (conversionBoxHeight / 2),
                                width: conversionBoxWidth,
                                height: conversionBoxHeight,
                                fill: d.color
                            })
                            .style({
                                opacity: opacity / 100
                            });
                    }
                    conversionPercent = Number(conversionValues[i].value);

                    let precisionValue: number;
                    precisionValue = conversionSettings.labelPrecision;
                    let iValueFormatter: IValueFormatter;
                    iValueFormatter = ValueFormatter.create({
                        value: 0,
                        precision: precisionValue
                    });

                    conversionPercent = iValueFormatter.format(conversionPercent);
                    if (displayValue === 'percent') {
                        conversionPercent += Visual.percentageLiteral;
                    }

                    const textProperties: TextProperties = {
                        text: conversionPercent,
                        fontFamily: categoryLabelSettings.fontFamily,
                        fontSize: conversionSettings.fontSize + Visual.pxLiteral
                    };

                    let boxPercentage: string;
                    let boxPercentageLength: number;
                    if (Visual.flag === 0) {
                        boxPercentage = textMeasurementService.getTailoredTextOrDefault(textProperties, conversionBoxWidth - 10);
                        boxPercentageLength = boxPercentage.length;
                        d3.select(Visual.dotLiteral + Visual.percentageValueLiteral + i)
                            .attr({
                                x: Visual.cX + (i * conversionBoxWidth) - (noOfFunnels * conversionBoxWidth) / 2 + conversionBoxWidth / 2,
                                y: Visual.cY + (conversionBoxHeight / 8)
                            }).text(boxPercentage)
                            .style('font-size', summaryLabelSize.toString() + Visual.pxLiteral)
                            .style('font-family', categoryLabelSettings.fontFamily)
                            .style('fill', summaryLabelColor.toString())
                            .style('visibility', visibility);
                    } else {
                        boxPercentage = textMeasurementService.getTailoredTextOrDefault(textProperties, conversionBoxWidth * 0.7);
                        if (conversionBoxHeight < conversionSettings.fontSize) {
                            visibility = 'hidden';
                        }
                        boxPercentageLength = boxPercentage.length;
                        d3.select(Visual.dotLiteral + Visual.percentageValueLiteral + i)
                            .attr({
                                y: Visual.cY + (i * conversionBoxHeight) - (noOfFunnels * conversionBoxHeight) / 2
                                    - conversionBoxHeight / 2,
                                x: Visual.cX - (conversionBoxWidth / 6)
                            }).text(boxPercentage)
                            .style('font-size', summaryLabelSize.toString() + Visual.pxLiteral)
                            .style('font-family', categoryLabelSettings.fontFamily)
                            .style('fill', summaryLabelColor.toString())
                            .style('visibility', visibility);
                    }

                    if (3 >= boxPercentageLength && '...' === boxPercentage) {
                        visibility = 'hidden';
                    }
                    // Repainting Box Percentage after finding out how much width it will take in Box

                    // tslint:disable-next-line:no-any
                    let textElement: any;
                    textElement = d3.select(Visual.dotLiteral + Visual.percentageValueLiteral + i);
                    const widthSize: number = textMeasurementService.measureSvgTextElementWidth(textElement.node());
                    const heightSize: number = textMeasurementService.measureSvgTextHeight(textElement.node());
                    let xAxis: number = 0;
                    if (Visual.flag === 0) {
                        xAxis = Visual.cX + (i * conversionBoxWidth) - (noOfFunnels * conversionBoxWidth) / 2
                            + (conversionBoxWidth - widthSize) / 2;
                        if (xAxis < 0) {
                            xAxis = 0;
                        }
                        d3.select(Visual.dotLiteral + Visual.percentageValueLiteral + i)
                            .attr({
                                x: xAxis
                            }).append('title').text(conversionPercent);
                    } else {
                        xAxis = Visual.cY + (i * conversionBoxHeight) - (noOfFunnels * conversionBoxHeight) / 2
                            + (conversionBoxHeight) / 2;
                        if (xAxis < 0) {
                            xAxis = 0;
                        }
                        d3.select(Visual.dotLiteral + Visual.percentageValueLiteral + i)
                            .attr({
                                y: xAxis
                            }).append('title').text(conversionPercent);
                    }
                    conversionXAxis = x;

                });
            }

            if (categoryLabelSettings.show) {
                const sourcetextProperties: TextProperties = {
                    text: viewModel.sourceName.toString(),
                    fontFamily: categoryLabelSettings.fontFamily,
                    fontSize: categoryLabelSettings.fontSize + Visual.pxLiteral
                };

                const destinationtextProperties: TextProperties = {
                    text: viewModel.destinationName.toString(),
                    fontFamily: categoryLabelSettings.fontFamily,
                    fontSize: categoryLabelSettings.fontSize + Visual.pxLiteral
                };

                let measureString: string;
                let measureStringLength: number;
                let visibility: string;
                let labelWidth: number;
                let isNarrow: boolean;
                let labelWidthDest: number;
                isNarrow = false;
                isLabelShrinked = false;
                visibility = 'visible';

                if (Visual.flag === 0) {
                    measureString = textMeasurementService.getTailoredTextOrDefault(sourcetextProperties, Visual.widthCategoryLabel);
                } else {
                    measureString = textMeasurementService.getTailoredTextOrDefault(sourcetextProperties, viewportWidth * 0.15);
                }
                if (viewportHeight <= 100) {
                    visibility = 'hidden';
                }
                measureStringLength = measureString.length;

                labelWidth = textMeasurementService.measureSvgTextWidth(sourcetextProperties);
                labelWidthDest = textMeasurementService.measureSvgTextWidth(destinationtextProperties);
                if (3 >= measureStringLength) {
                    visibility = 'hidden';
                }
                if (labelWidth < labelWidthDest) {
                    labelWidth = labelWidthDest;
                }

                const subStringlabel: string = measureString.substring(measureStringLength - 3, measureStringLength);
                let measureStringDest: string;
                if (Visual.flag === 1) {
                    measureStringDest = textMeasurementService.getTailoredTextOrDefault(destinationtextProperties,
                                                                                        viewportWidth * 0.15);
                } else {
                    measureStringDest = textMeasurementService.getTailoredTextOrDefault(destinationtextProperties,
                                                                                        Visual.widthCategoryLabel);
                }
                const measureStringDestLength: number = measureStringDest.length;
                const subStringlabelDest: string = measureStringDest.substring(measureStringDestLength - 3, measureStringDestLength);
                if ('...' === subStringlabel || '...' === subStringlabelDest) {
                    isNarrow = true;
                } else {
                    isNarrow = false;
                }

                if (!setstartXLabel) {
                    startXLabel = x;
                    setstartXLabel = true;
                }
                if (3 >= measureStringDestLength) {
                    visibility = 'hidden';
                }

                if (Visual.flag === 0) {
                    x = 0;
                } else {
                    y = 5;
                }
                // Adding Source Label and Aligning DataLabel(textlabel) with Measure Label.
                $this.categoryLabelDiv.append('text')
                    .classed(Visual.measureLabelLiteral, true)
                    .attr({
                        x: x,
                        y: y,
                        top: y,
                        title: viewModel.sourceName.toString()
                    })
                    .style('font-size', categoryLabelSettings.fontSize + Visual.pxLiteral)
                    .style('font-family', categoryLabelSettings.fontFamily)
                    .style('fill', categoryLabelSettings.fontColor)
                    .style('visibility', visibility)
                    .style('color', categoryLabelSettings.fontColor)
                    .style('top', y + Visual.pxLiteral)
                    .style('left', x + Visual.pxLiteral)
                    .style('title', viewModel.sourceName.toString());

                // For updating properties of Source measure label
                if (isEllipses) {
                    d3.select(Visual.dotLiteral + Visual.measureLabelLiteral)
                        .text(measureString)
                        .style('white-space', 'nowrap')
                        .style('overflow', 'hidden')
                        .style('text-overflow', 'ellipsis');
                } else {
                    measureString = viewModel.sourceName.toString();
                    d3.select(Visual.dotLiteral + Visual.measureLabelLiteral)
                        .text(measureString)
                        .style('word-wrap', ' break-word');
                }

                // Adding Destination Label
                let left: number;
                let top: number;

                if (Visual.flag === 0) {
                    top = yDest;
                    left = 0;
                } else {
                    top = 5;
                    left = xArrDest[0];
                }

                $this.categoryLabelDiv.append('text')
                    .classed(Visual.measureLabelDestLiteral, true)
                    .attr({
                        x: left,
                        y: top,
                        title: viewModel.destinationName.toString()
                    })
                    .style('top', top + Visual.pxLiteral)
                    .style('left', left + Visual.pxLiteral)
                    .style('font-size', categoryLabelSettings.fontSize + Visual.pxLiteral)
                    .style('font-family', categoryLabelSettings.fontFamily)
                    .style('fill', categoryLabelSettings.fontColor)
                    .style('visibility', visibility)
                    .style('color', categoryLabelSettings.fontColor)
                    .style('title', viewModel.destinationName.toString());

                // For updating properties of Destination measure label
                if (Visual.flag === 0) {
                    top = yDest;
                    left = 0;
                } else {
                    top = 5;
                    yDest = 5;
                    left = xDest;
                }
                if (isEllipses) {
                    if (Visual.flag === 1) {
                        measureStringDest = textMeasurementService.getTailoredTextOrDefault(destinationtextProperties,
                                                                                            viewportWidth * 0.15);
                    } else {
                        measureStringDest = textMeasurementService.getTailoredTextOrDefault(destinationtextProperties,
                                                                                            Visual.widthCategoryLabel);
                    }
                    measureStringLength = measureStringDest.length;

                    d3.select(Visual.dotLiteral + Visual.measureLabelDestLiteral)
                        .text(measureStringDest)
                        .style('top', yDest + Visual.pxLiteral)
                        .style('left', left + Visual.pxLiteral)
                        .style('white-space', 'nowrap')
                        .style('overflow', 'hidden')
                        .style('text-overflow', 'ellipsis');
                } else {
                    measureString = viewModel.destinationName.toString();
                    measureStringLength = measureString.length;
                    d3.select(Visual.dotLiteral + Visual.measureLabelDestLiteral)
                        .text(measureString)
                        .style('word-wrap', ' break-word');
                    d3.select(Visual.dotLiteral + Visual.measureLabelDestLiteral).attr({
                        x: xDest + Visual.pxLiteral,
                        y: 5 + Visual.pxLiteral,
                        title: viewModel.destinationName.toString()
                    })
                        .style('top', 5 + Visual.pxLiteral)
                        .style('left', xDest + Visual.pxLiteral);
                }

            }
            if (categoryLabelSettings.show && conversionSettings.show) {

                const converttextProperties: TextProperties = {
                    text: conversionSettings.label,
                    fontFamily: categoryLabelSettings.fontFamily,
                    fontSize: categoryLabelSettings.fontSize + Visual.pxLiteral
                };
                let conversionString: string;
                let conversionStringLength: number;
                let visibility: string;
                let xAxis: number;
                let yAxis: number;
                if (Visual.flag === 0) {
                    xAxis = 0;
                    yAxis = Visual.cY - 5;
                    conversionString = textMeasurementService.getTailoredTextOrDefault(converttextProperties,
                                                                                       Visual.widthCategoryLabel);
                    conversionStringLength = conversionString.length;
                } else {
                    yAxis = 5;
                    xAxis = Visual.cX - conversionBoxWidth;
                    conversionString = textMeasurementService.getTailoredTextOrDefault(converttextProperties,
                                                                                       viewportWidth * 0.29);
                    conversionStringLength = conversionString.length;
                }
                if (isEllipses) {
                    conversionString = textMeasurementService.getTailoredTextOrDefault(converttextProperties,
                                                                                       conversionXAxis);
                    conversionStringLength = conversionString.length;
                    visibility = 'visible';
                    if (3 >= conversionStringLength || 20 >= viewportHeight * Visual.MAXLENGTHMEASURELABEL) {
                        visibility = 'hidden';
                    }

                    // For aligning 'Conversion %' with Measure label
                    $this.categoryLabelDiv
                        .append('text')
                        .classed('conversionMsgContainer', true)
                        .attr({
                            x: xAxis,
                            y: yAxis,
                            top: yAxis,
                            title: conversionSettings.label,
                            id: 'conversionStringContainer'
                        })
                        .text(conversionString)
                        .style('id', 'conversionStringContainer')
                        .style('font-size', categoryLabelSettings.fontSize + Visual.pxLiteral)
                        .style('fill', categoryLabelSettings.fontColor)
                        .style('visibility', visibility)
                        .style('font-family', categoryLabelSettings.fontFamily)
                        .style('top', yAxis + Visual.pxLiteral)
                        .style('left', xAxis + 5 + Visual.pxLiteral)
                        .style('white-space', 'nowrap')
                        .style('overflow', 'hidden')
                        .style('color', categoryLabelSettings.fontColor)
                        .style('title', conversionSettings.label)
                        .style('text-overflow', 'ellipsis');
                } else {
                    if (xAxis >= startXLabel && (isLabelShrinked || viewportWidth * 0.4 <= 200)) {
                        xAxis = startXLabel;
                    }
                    const labelWidth: number = textMeasurementService.measureSvgTextWidth(converttextProperties);
                    conversionString = conversionSettings.label;
                    conversionStringLength = conversionString.length;
                    visibility = 'visible';
                    if (3 >= conversionStringLength || 50 >= viewportWidth * 0.28) {
                        visibility = 'hidden';
                    }
                    if ((3 >= conversionStringLength || 60 >= viewportHeight * Visual.MAXLENGTHMEASURELABEL) && Visual.flag === 1) {
                        visibility = 'hidden';
                    }
                    $this.categoryLabelDiv
                        .append('text')
                        .classed('conversionMsgContainer', true)
                        .attr({
                            x: xAxis,
                            y: yAxis,
                            top: yAxis,
                            title: conversionSettings.label
                        })
                        .text(conversionString)
                        .style('font-size', categoryLabelSettings.fontSize + Visual.pxLiteral)
                        .style('fill', categoryLabelSettings.fontColor)
                        .style('visibility', visibility)
                        .style('font-family', categoryLabelSettings.fontFamily)
                        .style('top', Visual.cY - (conversionBoxHeight / 6) + Visual.pxLiteral)
                        .style('color', categoryLabelSettings.fontColor)
                        .style('title', conversionSettings.label)
                        .style('word-wrap', ' break-word');
                }
            }

            this.addConversionSelection(conversionSettings.transparency);
            this.updateStyleColor(viewModel);

            const str: string = viewModel.sourceName;
            $this.tooltipServiceWrapper.addTooltip($this.visualCont.selectAll('.funnel'),
                                                   (tooltipEvent: TooltipEventArgs<number>) => this.getTooltipData(tooltipEvent.data),
                                                   (tooltipEvent: TooltipEventArgs<number>) => null
            );

            $this.tooltipServiceWrapper.addTooltip($this.visualCont.selectAll('.conversionContainer'),
                                                   (tooltipEvent: TooltipEventArgs<number>) => $this.getTooltipDataForConversion(
                    tooltipEvent.data,
                    viewModel.categoryName,
                    conversionSettings.label),
                                                   (tooltipEvent: TooltipEventArgs<number>) => null);
            $this.addLegendSelection(conversionSettings.transparency);
            // tslint:disable-next-line:no-any
            const legendNavClick: any = document.getElementById('legendGroup');
            legendNavClick.onclick = function (): void {
                $this.addLegendSelection(conversionSettings.transparency);
            };

            $this.visualSelection = $this.visualCont
                .selectAll('.funnel')
                .data(viewModel.dataPoints);

            this.visualCont.on('click', () => Visual.selectionManager.clear().then(
                () => {
                    d3.selectAll(Visual.dotLiteral + Visual.upperTriLiteral).style({
                        opacity: '1'
                    });
                    d3.selectAll(Visual.dotLiteral + Visual.lowerTriLiteral).style({
                        opacity: '1'
                    });
                    d3.selectAll(Visual.dotLiteral + Visual.percentageBgLiteral).style({
                        opacity: (100 - conversionSettings.transparency) / 100
                    });
                    d3.selectAll('.legendItem').attr('fill-opacity', 1);
                }
            ));

            triData.exit().remove();
        }

        // tslint:disable-next-line:no-any
        public static findlabelTextAndVisibilityDest(dataLevel: any, startDownTriX: number, dataPercentage: string,
            // tslint:disable-next-line:no-any
                                                     baseDownTri: number, options: any, dataValue: any, cX: number, cY: number,
                                                     funnelWidth: number, funnelHeight: number, maxWidth: number, maxHeight: number): {
                visibility: string;
                labelText: string;
                xAxis: number;
                yAxis: number;
            } {
            const textProperties: TextProperties = {
                text: dataLevel,
                fontFamily: Visual.categoryLabelSettings.fontFamily,
                fontSize: Visual.detailLabelSettings.fontSize + Visual.pxLiteral
            };

            const finalValue: string = Visual.getValueByUnits(Visual.detailLabelSettings.labelDisplayUnits,
                                                              Visual.detailLabelSettings.labelPrecision, dataValue);
            let labelText: string = finalValue + Visual.spaceLiteral + Visual.openBracketLiteral
                + dataPercentage + Visual.closeBracketLiteral;
            dataLevel = labelText;
            const labeltextProperties: TextProperties = {
                text: labelText,
                fontFamily: Visual.categoryLabelSettings.fontFamily,
                fontSize: Visual.detailLabelSettings.fontSize + Visual.pxLiteral
            };

            let labelWidth: number;
            labelWidth = textMeasurementService.measureSvgTextWidth(labeltextProperties);
            let labelHeight: number;
            labelHeight = textMeasurementService.measureSvgTextHeight(labeltextProperties);

            let baseEnd: number;
            let xAxis: number;
            let yAxis: number;
            let visibility: string = 'visible';
            if (Visual.flag === 0) {
                if (labelWidth > baseDownTri * 0.65) {
                    labelText = textMeasurementService.getTailoredTextOrDefault(labeltextProperties, baseDownTri * 0.65);
                }
                baseEnd = startDownTriX + baseDownTri;
                xAxis = Math.max((((startDownTriX + baseEnd) / 2) - labelWidth / 2), startDownTriX);
                yAxis = (Visual.cY + maxHeight * 0.5);

                if (yAxis + labelHeight * 0.65 > funnelHeight) {
                    visibility = 'hidden';
                }
                if (baseDownTri <= funnelWidth * 0.3) {
                    labelText = textMeasurementService.getTailoredTextOrDefault(labeltextProperties,
                                                                                startDownTriX + baseDownTri - (xAxis));
                }
            } else {
                baseEnd = startDownTriX + baseDownTri;
                yAxis = Math.min(((startDownTriX + baseEnd) / 2 - labelHeight * 0.3), (startDownTriX + baseEnd) / 2);
                xAxis = (Visual.cX + maxWidth * 0.5);
                labelText = textMeasurementService.getTailoredTextOrDefault(labeltextProperties,
                                                                            funnelWidth - xAxis);
                if (baseDownTri < labelHeight) {
                    visibility = 'hidden';
                }
            }

            const subStringLabelText: string = labelText.substring(0, 4);
            const subLabelText: string = labelText.substring(labelText.length - 4, labelText.length);
            if (' ...' === subLabelText || '....' === subLabelText) {
                labelText = labelText.substring(0, labelText.length - 4) + labelText.substring(labelText.length - 3, labelText.length - 0);
            }
            if ('null' === subStringLabelText || '...' === labelText) {
                visibility = 'hidden';
            }
            if (!this.visibilityTextLabel && visibility) {
                this.visibilityTextLabel = true;
            }

            return ({
                visibility: visibility,
                labelText: labelText,
                xAxis: xAxis,
                yAxis: yAxis
            });
        }

        // tslint:disable-next-line:no-any
        public static getValueByUnits(displayUnits: number, precisionValue: number, dataValue: any): string {
            switch (Visual.detailLabelSettings.labelDisplayUnits) {
                case 1000:
                    displayUnits = 1001;
                    break;
                case 1000000:
                    displayUnits = 1e6;
                    break;
                case 1000000000:
                    displayUnits = 1e9;
                    break;
                case 1000000000000:
                    displayUnits = 1e12;
                    break;
                case 0:
                    displayUnits = getAutoByUnits(dataValue, displayUnits);
                    break;
                default:
                    break;
            }
            let iValueFormatter: IValueFormatter;
            if (precisionValue === 0) {
                iValueFormatter = ValueFormatter.create({
                    value: displayUnits
                });
            } else {
                iValueFormatter = ValueFormatter.create({
                    value: displayUnits,
                    precision: precisionValue
                });
            }

            return iValueFormatter.format(dataValue);
        }

        private addConversionSelection(o: number): void {
            const THIS: this = this;
            // tslint:disable-next-line:no-any
            let conversionBox: any;
            conversionBox = this.visualCont.selectAll('.conversionContainer');
            // tslint:disable-next-line:no-any
            let legends: any;
            legends = d3.selectAll('.legend .legendItem');
            // tslint:disable-next-line:no-any
            conversionBox.on('click', function (d: any): void {
                // tslint:disable-next-line:no-any
                Visual.selectionManager.select(d.selectionId).then((ids: any[]) => {
                    // tslint:disable-next-line:no-any
                    function CompareIds(legendData: any): number {
                        if (ids.length) {
                            if (legendData.identity.key === ids[0].key) {
                                return 1;
                            } else {
                                return 0.5;
                            }
                        } else {
                            return 1;
                        }
                    }
                    // tslint:disable-next-line:no-any
                    let oSelclassObj: any = d.category;
                    oSelclassObj = oSelclassObj.replace(/\s/g, '');
                    oSelclassObj = oSelclassObj.replace(/[^a-zA-Z ]/g, '');
                    d3.selectAll(Visual.dotLiteral + Visual.upperTriLiteral).style({
                        opacity: '0.5'
                    });
                    d3.selectAll(Visual.dotLiteral + Visual.lowerTriLiteral).style({
                        opacity: '0.5'
                    });
                    d3.selectAll(Visual.dotLiteral + Visual.percentageBgLiteral).style({
                        opacity: '0.5'
                    });
                    d3.select(Visual.dotLiteral + oSelclassObj + Visual.dotLiteral + Visual.upperTriLiteral).classed('selected', true);
                    d3.select(Visual.dotLiteral + oSelclassObj + Visual.dotLiteral + Visual.upperTriLiteral).style({
                        opacity: '1'
                    });
                    d3.select(Visual.dotLiteral + oSelclassObj + Visual.dotLiteral + Visual.lowerTriLiteral).style({
                        opacity: '1'
                    })
                        .classed('selected', true);
                    d3.select(Visual.dotLiteral + oSelclassObj + Visual.dotLiteral + Visual.percentageBgLiteral).style({
                        opacity: '1'
                    });

                    // tslint:disable-next-line:no-any
                    legends.attr('fill-opacity', (d1: any) => {
                        return CompareIds(d1);
                    });

                    if (ids.length < 1) {
                        d3.selectAll(Visual.dotLiteral + Visual.upperTriLiteral).style({
                            opacity: '1'
                        });
                        d3.selectAll(Visual.dotLiteral + Visual.lowerTriLiteral).style({
                            opacity: '1'
                        });
                        d3.selectAll(Visual.dotLiteral + Visual.percentageBgLiteral).style({
                            opacity: (100 - o) / 100
                        });
                    }
                });
                (<Event>d3.event).stopPropagation();
            });
        }

        private addTriangleSelection(o: number): void {
            const THIS: this = this;
            // tslint:disable-next-line:no-any
            let funnels: any;
            funnels = d3.selectAll('.funnel');
            // tslint:disable-next-line:no-any
            let legends: any;
            legends = d3.selectAll('.legend .legendItem');
            // tslint:disable-next-line:no-any
            funnels.on('click', function (d: any): void {
                // tslint:disable-next-line:no-any
                Visual.selectionManager.select(d.selectionId).then((ids: any[]) => {
                    // tslint:disable-next-line:no-any
                    function CompareIds(legendData: any): number {
                        if (ids.length) {
                            if (legendData.identity.key === ids[0].key) {
                                return 1;
                            } else {
                                return 0.5;
                            }
                        } else {
                            return 1;
                        }
                    }

                    // tslint:disable-next-line:no-any
                    let oSelclassObj: any = d.category;
                    oSelclassObj = oSelclassObj.replace(/\s/g, '');
                    oSelclassObj = oSelclassObj.replace(/[^a-zA-Z ]/g, '');
                    d3.selectAll(Visual.dotLiteral + Visual.upperTriLiteral).style({
                        opacity: '0.5'
                    });
                    d3.selectAll(Visual.dotLiteral + Visual.lowerTriLiteral).style({
                        opacity: '0.5'
                    });
                    d3.selectAll(Visual.dotLiteral + Visual.percentageBgLiteral).style({
                        opacity: '0.5'
                    });
                    d3.select(Visual.dotLiteral + oSelclassObj + Visual.dotLiteral + Visual.upperTriLiteral).classed('selected', true);
                    d3.select(Visual.dotLiteral + oSelclassObj + Visual.dotLiteral + Visual.upperTriLiteral).style({
                        opacity: '1'
                    });
                    d3.select(Visual.dotLiteral + oSelclassObj + Visual.dotLiteral + Visual.lowerTriLiteral).style({
                        opacity: '1'
                    }).classed('selected', true);
                    d3.select(Visual.dotLiteral + oSelclassObj + Visual.dotLiteral + Visual.percentageBgLiteral).style({
                        opacity: '1'
                    });
                    // tslint:disable-next-line:no-any
                    legends.attr('fill-opacity', (d1: any) => {
                        return CompareIds(d1);
                    });
                    // tslint:disable-next-line:no-any
                    if (ids.length < 1) {
                        d3.selectAll(Visual.dotLiteral + Visual.upperTriLiteral).style({
                            opacity: '1'
                        });
                        d3.selectAll(Visual.dotLiteral + Visual.lowerTriLiteral).style({
                            opacity: '1'
                        });
                        d3.selectAll(Visual.dotLiteral + Visual.percentageBgLiteral).style({
                            opacity: (100 - o) / 100
                        });
                    }
                });
                (<Event>d3.event).stopPropagation();
            });

        }
        private addLegendSelection(o: number): void {
            const THIS: this = this;
            // tslint:disable-next-line:no-any
            let legends: any;
            legends = d3.selectAll('.legend .legendItem');
            // tslint:disable-next-line:no-any
            legends.on('click', function (d: any): void {
                // tslint:disable-next-line:no-any
                Visual.selectionManager.select(d.identity).then((ids: ISelectionId[]) => {
                    // tslint:disable-next-line:no-any
                    let oSelclassObj: any = d.tooltip;
                    oSelclassObj = oSelclassObj.replace(/\s/g, '');
                    oSelclassObj = oSelclassObj.replace(/[^a-zA-Z ]/g, '');
                    d3.selectAll(Visual.dotLiteral + Visual.upperTriLiteral).style({
                        opacity: '0.5'
                    });
                    d3.selectAll(Visual.dotLiteral + Visual.lowerTriLiteral).style({
                        opacity: '0.5'
                    });
                    d3.selectAll(Visual.dotLiteral + Visual.percentageBgLiteral).style({
                        opacity: '0.5'
                    });
                    d3.select(Visual.dotLiteral + oSelclassObj + Visual.dotLiteral + Visual.upperTriLiteral).classed('selected', true);
                    d3.select(Visual.dotLiteral + oSelclassObj + Visual.dotLiteral + Visual.upperTriLiteral).style({
                        opacity: '1'
                    });
                    d3.select(Visual.dotLiteral + oSelclassObj + Visual.dotLiteral + Visual.lowerTriLiteral).style({
                        opacity: '1'
                    })
                        .classed('selected', true);
                    d3.selectAll(Visual.dotLiteral + oSelclassObj + Visual.dotLiteral + Visual.percentageBgLiteral).style({
                        opacity: '1'
                    });
                    legends.attr({
                        'fill-opacity': ids.length > 0 ? 0.5 : 1
                    });
                    d3.select(this).attr({
                        'fill-opacity': 1
                    });
                    if (ids.length < 1) {
                        d3.selectAll(Visual.dotLiteral + Visual.upperTriLiteral).style({
                            opacity: '1'
                        });
                        d3.selectAll(Visual.dotLiteral + Visual.lowerTriLiteral).style({
                            opacity: '1'
                        });
                        d3.selectAll(Visual.dotLiteral + Visual.percentageBgLiteral).style({
                            opacity: (100 - o) / 100
                        });
                    }
                });
                (<Event>d3.event).stopPropagation();
            });
        }

        public updateStyleColor(viewModel: IVisualViewModel): void {
            if (!this.myStyles) {
                this.myStyles = this.visualCont
                    .append('style');
            }

            //  setting the boxes color
            let style: string;
            style = '';
            let styleD: string;
            styleD = '';
            const $this: this = this;
            const triData: d3.selection.Update<IVisualDataPoint> = this.visualCont.selectAll('.funnel')
                .data(viewModel.dataPoints);

            triData.each(function (d: IVisualDataPoint, index: number): void {
                let catVar: string = d.category.toString();
                catVar = catVar.replace(/\s/g, '');
                catVar = catVar.replace(/[^a-zA-Z ]/g, '');
                let color: string;
                color = d.color;
                let str: string;
                str = Visual.dotLiteral + catVar + Visual.dotLiteral + Visual.upperTriLiteral;
                let strLowerTriangle: string;
                strLowerTriangle = Visual.dotLiteral + catVar + Visual.dotLiteral + Visual.lowerTriLiteral;
                let strConversion: string;
                strConversion = Visual.dotLiteral + catVar + Visual.dotLiteral + Visual.percentageBgLiteral;
                if (Visual.gradientSettings.show) {
                    this.gradient = $this.visualCont.append('svg:linearGradient');
                    this.gradient.attr('id', `gradient${index}`)
                        .attr('x1', '100%')
                        .attr('y1', '0%')
                        .attr('x2', '100%')
                        .attr('y2', '100%')
                        .attr('spreadMethod', 'pad');
                    this.gradient.append('stop').attr('offset', '0%').attr('stop-color', color).attr('stop-opacity', 1);
                    const rColor: string = $this.getDarkShade(color, 0.6);
                    this.gradient.append('stop').attr('offset', '100%').attr('stop-color', rColor).attr('stop-opacity', 1);
                    style += `${str}{fill:url(#gradient${index});background:${rColor};}`;
                    style += `${strLowerTriangle}{fill:url(#gradient${index});background:${rColor};}`;
                    style += `${strConversion}{fill:url(#gradient${index});background:${rColor};}`;
                } else {
                    style += `${str}{fill:${color};background:${color};}`;
                    style += `${strLowerTriangle}{fill:${color};background:${color};}`;
                    style += `${strConversion}{fill:${color});background:${color};}`;
                }

            });
            this.myStyles.html(style);
        }

        public getDarkShade(colorHEX: string, opacity: number): string {
            colorHEX = String(colorHEX).replace(/[^0-9a-f]/gi, '');
            if (colorHEX.length < 6) {
                colorHEX = colorHEX[0] + colorHEX[0] + colorHEX[1] + colorHEX[1] + colorHEX[2] + colorHEX[2];
            }
            opacity = opacity || 0;
            let rgb: string = '#';
            // tslint:disable-next-line:no-any
            let c: any;
            let iCounter: number;
            for (iCounter = 0; iCounter < 3; iCounter++) {
                c = parseInt(colorHEX.substr(iCounter * 2, 2), 16);
                c = Math.round(Math.min(Math.max(0, c + (c * opacity)), 255)).toString(16);
                rgb += (`00${c}`).substr(c.length);
            }

            return rgb;
        }

        // tslint:disable-next-line:no-any
        public static findlabetTextAndVisibilitySource(dataLevel: any, startUpTriX: number, dataPercentage: string,
            // tslint:disable-next-line:no-any
                                                       baseUpTri: number, dataValue: any, cX: number, options: any,
                                                       isEllipses: boolean, cY: number, funnelWidth: number, funnelHeight: number
            ,                                          maxWidth: number, maxHeight: number): {
                visibility: string;
                labelText: string;
                xAxis: number;
                yAxis: number;
            } {
            const textProperties: TextProperties = {
                text: dataLevel,
                fontFamily: Visual.categoryLabelSettings.fontFamily,
                fontSize: Visual.detailLabelSettings.fontSize + Visual.pxLiteral
            };
            let labelWidth: number;
            let labelHeight: number;
            let labelText: string;
            const startXCurrent: number = startUpTriX;
            // tslint:disable-next-line:no-any
            const finalValue: any = Visual.getValueByUnits(Visual.detailLabelSettings.labelDisplayUnits,
                                                           Visual.detailLabelSettings.labelPrecision, dataValue);
            const newLabelText: string = finalValue + Visual.spaceLiteral + Visual.openBracketLiteral
                + dataPercentage + Visual.closeBracketLiteral;
            dataLevel = newLabelText;

            const labeltextProperties: TextProperties = {
                text: newLabelText,
                fontFamily: Visual.categoryLabelSettings.fontFamily,
                fontSize: Visual.detailLabelSettings.fontSize + Visual.pxLiteral
            };
            labelWidth = textMeasurementService.measureSvgTextWidth(labeltextProperties);
            labelHeight = textMeasurementService.measureSvgTextHeight(labeltextProperties);
            let baseEnd: number;
            let xAxis: number;
            let yAxis: number;
            let visibility: string = 'visible';
            labelText = dataLevel;

            if (Visual.flag === 0) {
                baseEnd = startXCurrent + baseUpTri;
                xAxis = Math.max(((startXCurrent + baseEnd) / 2 - labelWidth / 2), startXCurrent);
                yAxis = (Visual.cY - maxHeight * 0.5);
                labelText = textMeasurementService.getTailoredTextOrDefault(labeltextProperties, baseUpTri * 0.7);
                if (yAxis < Visual.heightCategoryLabel + Visual.detailLabelSettings.fontSize * 0.2) {
                    visibility = 'hidden';
                }
            } else {
                baseEnd = startUpTriX + baseUpTri;
                yAxis = (startUpTriX + baseEnd) / 2 + labelHeight * 0.2;
                xAxis = Math.max((Visual.cX - maxWidth * 0.55), 0);
                labelText = textMeasurementService.getTailoredTextOrDefault(labeltextProperties, Visual.cX - maxWidth * 0.475 - xAxis);
                if (baseUpTri < labelHeight) {
                    visibility = 'hidden';
                }
            }

            const subStringLabelText: string = labelText.substring(0, 4);
            if ('null' === subStringLabelText || '...' === labelText) {
                visibility = 'hidden';
            }

            const subLabelText: string = labelText.substring(labelText.length - 4, labelText.length);
            if (subLabelText === ' ...' || '....' === subLabelText) {
                labelText = labelText.substring(0, labelText.length - 4) + labelText.substring(labelText.length - 3, labelText.length - 0);
            }

            return ({
                visibility: visibility,
                labelText: labelText,
                xAxis: xAxis,
                yAxis: yAxis
            });
        }

        // tslint:disable-next-line:no-any
        public static findlabelTextAndVisibilitySrc(dataLevel: any, width: number, dataPercentage: string,
            // tslint:disable-next-line:no-any
                                                    baseUpTri: number, dataValue: any, cX: number, options: any,
                                                    isEllipses: boolean, cY: number, xArr: number, yArr: number, funnelHeight: number,
                                                    funnelWidth: number): {
                visibility: string;
                labelText: string;
                xAxis: number;
                yAxis: number;
            } {
            const textProperties: TextProperties = {
                text: dataLevel,
                fontFamily: Visual.categoryLabelSettings.fontFamily,
                fontSize: Visual.detailLabelSettings.fontSize + Visual.pxLiteral
            };
            let labelWidth: number;
            let labelHeight: number;
            let labelText: string;
            // tslint:disable-next-line:no-any
            const finalValue: any = Visual.getValueByUnits(Visual.detailLabelSettings.labelDisplayUnits,
                                                           Visual.detailLabelSettings.labelPrecision, dataValue);
            const newLabelText: string = finalValue + Visual.spaceLiteral + Visual.openBracketLiteral
                + dataPercentage + Visual.closeBracketLiteral;
            dataLevel = newLabelText;

            const labeltextProperties: TextProperties = {
                text: newLabelText,
                fontFamily: Visual.categoryLabelSettings.fontFamily,
                fontSize: Visual.detailLabelSettings.fontSize + Visual.pxLiteral
            };
            labelWidth = textMeasurementService.measureSvgTextWidth(labeltextProperties);
            labelHeight = textMeasurementService.measureSvgTextHeight(labeltextProperties);
            let xAxis: number;
            let yAxis: number;
            let visibility: string = 'visible';
            labelText = dataLevel;
            if (Visual.dataLabelFlip) {
                if (Visual.flag === 0) {
                    xAxis = Math.max((((Visual.cX + (width + xArr) / 2)) * 1.05), 0);
                    yAxis = (Visual.cY - (baseUpTri + yArr) / 2);
                    labelText = textMeasurementService.getTailoredTextOrDefault(labeltextProperties,
                                                                                funnelWidth - xAxis);
                    if (Math.abs(baseUpTri - yArr) < Visual.detailLabelSettings.fontSize) {
                        visibility = 'hidden';
                    }
                } else {
                    xAxis = Math.max(((Visual.cX - (width + xArr) / 2) - labelWidth / 2), Visual.cX - width);
                    yAxis = (Visual.cY - (baseUpTri + yArr) / 2) * 0.9;
                    if (yAxis <= (Visual.heightCategoryLabel + labelHeight)) {
                        visibility = 'hidden';
                    }
                    labelText = textMeasurementService.getTailoredTextOrDefault(labeltextProperties, Math.abs(xArr - width));
                }
            } else {
                if (Visual.flag === 0) {
                    xAxis = Math.max((((Visual.cX - (width + xArr) / 2)) * 0.9 - labelWidth * 0.9), 0);
                    yAxis = (Visual.cY - (baseUpTri + yArr) / 2);
                    labelText = textMeasurementService.getTailoredTextOrDefault(labeltextProperties,
                                                                                ((Visual.cX - (width + xArr) / 2)) * 0.9);
                    if (Math.abs(baseUpTri - yArr) < Visual.detailLabelSettings.fontSize) {
                        visibility = 'hidden';
                    }
                } else {
                    xAxis = Math.max(((Visual.cX - (width + xArr) / 2) - labelWidth / 2), Visual.cX - width);
                    yAxis = Visual.cY + (baseUpTri + yArr) / 2 * 1.1 + 20;
                    if (yAxis + labelHeight > funnelHeight) {
                        visibility = 'hidden';
                    }
                    labelText = textMeasurementService.getTailoredTextOrDefault(labeltextProperties, Math.abs(xArr - width));
                }
            }

            const subStringLabelText: string = labelText.substring(0, 4);
            if ('null' === subStringLabelText || '...' === labelText || funnelHeight < 100) {
                visibility = 'hidden';
            }

            const subLabelText: string = labelText.substring(labelText.length - 4, labelText.length);
            if (subLabelText === ' ...' || '....' === subLabelText) {
                labelText = labelText.substring(0, labelText.length - 4) + labelText.substring(labelText.length - 3, labelText.length - 0);
            }

            return ({
                visibility: visibility,
                labelText: labelText,
                xAxis: xAxis,
                yAxis: yAxis
            });
        }

        // tslint:disable-next-line:no-any
        public static findlabelTextAndVisibilityDestination(dataLevel: any, width: number, dataPercentage: string,
            // tslint:disable-next-line:no-any
                                                            baseDownTri: number, dataValue: any, cX: number, options: any,
                                                            isEllipses: boolean, cY: number, xArr: number, yArr: number,
                                                            funnelHeight: number, funnelWidth: number): {
                visibility: string;
                labelText: string;
                xAxis: number;
                yAxis: number;
            } {
            const textProperties: TextProperties = {
                text: dataLevel,
                fontFamily: Visual.categoryLabelSettings.fontFamily,
                fontSize: Visual.detailLabelSettings.fontSize + Visual.pxLiteral
            };
            let labelWidth: number;
            let labelText: string;
            let labelHeight: number;
            // tslint:disable-next-line:no-any
            const finalValue: any = Visual.getValueByUnits(Visual.detailLabelSettings.labelDisplayUnits,
                                                           Visual.detailLabelSettings.labelPrecision, dataValue);
            const newLabelText: string = finalValue + Visual.spaceLiteral + Visual.openBracketLiteral
                + dataPercentage + Visual.closeBracketLiteral;
            dataLevel = newLabelText;

            const labeltextProperties: TextProperties = {
                text: newLabelText,
                fontFamily: Visual.categoryLabelSettings.fontFamily,
                fontSize: Visual.detailLabelSettings.fontSize + Visual.pxLiteral
            };
            labelWidth = textMeasurementService.measureSvgTextWidth(labeltextProperties);
            labelHeight = textMeasurementService.measureSvgTextHeight(labeltextProperties);
            let xAxis: number;
            let yAxis: number;
            let visibility: string = 'visible';
            labelText = dataLevel;

            if (Visual.dataLabelFlip) {
                if (Visual.flag === 0) {
                    xAxis = Math.max((((Visual.cX + (width + xArr) / 2)) * 1.05), 0);
                    yAxis = Visual.cY + (baseDownTri + yArr) / 2;
                    labelText = textMeasurementService.getTailoredTextOrDefault(labeltextProperties,
                                                                                funnelWidth - xAxis);
                    if (Math.abs(baseDownTri - yArr) < Visual.detailLabelSettings.fontSize) {
                        visibility = 'hidden';
                    }
                } else {
                    xAxis = xArr === 0 ? Math.max(((Visual.cX + (width + xArr) / 2) - labelWidth / 2), Visual.cX + 5) :
                        Math.max(((Visual.cX + (width + xArr) / 2) - labelWidth / 2), Visual.cX + xArr);
                    yAxis = (Visual.cY - (baseDownTri + yArr) / 2) * 0.9;
                    if (yAxis < Visual.heightCategoryLabel + labelHeight) {
                        visibility = 'hidden';
                    }
                    labelText = textMeasurementService.getTailoredTextOrDefault(labeltextProperties, Math.abs(xArr - width));
                }
            } else {
                if (Visual.flag === 0) {
                    xAxis = Math.max((((Visual.cX - (width + xArr) / 2)) * 0.9 - labelWidth * 0.9), 0);
                    yAxis = (Visual.cY + (baseDownTri + yArr) / 2);
                    labelText = textMeasurementService.getTailoredTextOrDefault(labeltextProperties,
                                                                                ((Visual.cX - (width + xArr) / 2)) * 0.9);
                    if (Math.abs(baseDownTri - yArr) < Visual.detailLabelSettings.fontSize) {
                        visibility = 'hidden';
                    }
                } else {
                    xAxis = xArr === 0 ? Math.max(((Visual.cX + (width + xArr) / 2) - labelWidth / 2),
                                                  Visual.cX + Visual.conversionBoxWidth / 2) :
                        Math.max(((Visual.cX + (width + xArr) / 2) - labelWidth / 2), Visual.cX + xArr);
                    yAxis = Visual.cY + (baseDownTri + yArr) / 2 * 1.1 + 20;
                    if (yAxis + labelHeight > funnelHeight) {
                        visibility = 'hidden';
                    }
                    const availableWidth: number = xArr === 0 ? width - Visual.conversionBoxWidth / 2 : Math.abs(xArr - width);
                    labelText = textMeasurementService.getTailoredTextOrDefault(labeltextProperties, availableWidth);
                }
            }

            const subStringLabelText: string = labelText.substring(0, 4);
            if ('null' === subStringLabelText || '...' === labelText) {
                visibility = 'hidden';
            }

            const subLabelText: string = labelText.substring(labelText.length - 4, labelText.length);
            if (subLabelText === ' ...' || '....' === subLabelText) {
                labelText = labelText.substring(0, labelText.length - 4) + labelText.substring(labelText.length - 3, labelText.length - 0);
            }

            return ({
                visibility: visibility,
                labelText: labelText,
                xAxis: xAxis,
                yAxis: yAxis
            });
        }

        public static getCategoryLabelHeight(viewModel: IVisualViewModel): number {
            if (!Visual.categoryLabelSettings.show) {
                return 0;
            }

            const textProperties: TextProperties = {
                text: viewModel.sourceName,
                fontFamily: Visual.categoryLabelSettings.fontFamily,
                fontSize: Visual.categoryLabelSettings.fontSize + Visual.pxLiteral
            };

            const destinationtextProperties: TextProperties = {
                text: viewModel.destinationName,
                fontFamily: Visual.categoryLabelSettings.fontFamily,
                fontSize: Visual.categoryLabelSettings.fontSize + Visual.pxLiteral
            };

            return Math.max(textMeasurementService.measureSvgTextHeight(textProperties),
                            textMeasurementService.measureSvgTextHeight(destinationtextProperties));
        }

        public static getCategoryLabelWidth(viewModel: IVisualViewModel): number {
            if (!Visual.categoryLabelSettings.show) {
                return 0;
            }

            const textProperties: TextProperties = {
                text: viewModel.sourceName,
                fontFamily: Visual.categoryLabelSettings.fontFamily,
                fontSize: Visual.categoryLabelSettings.fontSize + Visual.pxLiteral
            };

            const destinationtextProperties: TextProperties = {
                text: viewModel.destinationName,
                fontFamily: Visual.categoryLabelSettings.fontFamily,
                fontSize: Visual.categoryLabelSettings.fontSize + Visual.pxLiteral
            };

            return Math.max(textMeasurementService.measureSvgTextWidth(textProperties),
                            textMeasurementService.measureSvgTextWidth(destinationtextProperties));
        }

        // tslint:disable-next-line:no-any
        public static calculateLowerMaxWidth(maxBaseWidth: number, viewModel: any): number {
            const sumOfSource: number = viewModel.sumOfSource;
            const sumOfDestination: number = viewModel.sumOfDestination;
            if (sumOfSource > sumOfDestination) {
                maxBaseWidth = maxBaseWidth * (sumOfDestination / sumOfSource);
            }

            return maxBaseWidth;
        }

        // tslint:disable-next-line:no-any
        public static calculateLowerMaxHeight(maxBaseHeight: number, viewModel: any): number {
            const sumOfSource: number = viewModel.sumOfSource;
            const sumOfDestination: number = viewModel.sumOfDestination;
            if (sumOfSource > sumOfDestination) {
                maxBaseHeight = maxBaseHeight * (sumOfDestination / sumOfSource);
            }

            return maxBaseHeight;
        }

        public static calculatePercentage(numerator: number, denominator: number): string {
            return Math.round(numerator / denominator * 100) + Visual.pxLiteral;
        }

        public static GetTriangleUpPath(cX: number, cY: number, startX: number, height: number, base: number, flag: number): string {
            if (flag === 0) {
                return `M ${cX} ${cY} L ${startX} ${cY - height} L ${startX + base} ${cY - height} Z`;
            }

            return `M ${cX} ${cY} L ${cX - height} ${startX + base} L ${cX - height} ${startX} Z`;
        }

        public static GetTriangleDownPath(cX: number, cY: number, startX: number, height: number, base: number, flag: number): string {
            if (flag === 0) {
                return `M ${cX} ${cY} L ${startX} ${cY + height} L ${startX + base} ${cY + height} Z`;
            }

            return `M ${cX} ${cY} L ${cX + height} ${startX + base} L ${cX + height} ${startX} Z`;

        }

        public static GetTriangleDownH(cX: number, cY: number, base: number, width: number, flag: number,
                                       xPrev: number, yPrev: number): string {
            if (flag === 0) {
                return `${cX - xPrev}, ${cY + yPrev} ${cX + xPrev} , ${cY + yPrev}
                ${cX + width} , ${cY + base} ${cX - width} , ${cY + base}`;
            } else {
                return `${cX + xPrev}, ${cY - yPrev} ${cX + xPrev} , ${cY + yPrev}
                ${cX + width} , ${cY + base} ${cX + width} , ${cY - base}`;
            }

        }

        public static GetTriangleUpH(cX: number, cY: number, base: number, width: number, flag: number,
                                     xPrev: number, yPrev: number): string {
            if (flag === 0) {
                return `${cX - xPrev}, ${cY - yPrev} ${cX + xPrev} , ${cY - yPrev}
                     ${cX + width} , ${cY - base} ${cX - width} , ${cY - base}`;
            }

            return `${cX - xPrev}, ${cY - yPrev} ${cX - xPrev} , ${cY + yPrev}
                    ${cX - width} , ${cY + base} ${cX - width} , ${cY - base}`;
        }

        public static GetSeparatorUpH(cX: number, cY: number, startX: number, height: number, base: number): string {
            if (Visual.flag === 0) {
                return `M ${cX + startX} ${cY - base} L ${cX - startX} ${cY - base} Z`;
            } else {
                return `M ${cX - startX} ${cY + base} L ${cX - startX} ${cY - base} Z`;
            }
        }

        public static GetSeparatorDownH(cX: number, cY: number, startX: number, height: number, base: number): string {
            if (Visual.flag === 0) {
                return `M ${cX + startX} ${cY + base} L ${cX - startX}  ${cY + base} Z`;
            } else {
                return `M  ${cX + startX} ${cY + base} L ${cX + startX} ${cY - base} Z`;
            }
        }

        public static GetSeparatorUpPath(cX: number, cY: number, startX: number, height: number, base: number): string {
            if (Visual.flag === 0) {
                return `M ${startX + base}  ${cY - height} L ${cX} ${cY}`;
            } else {
                return `M ${cX - height}  ${startX + base} L ${cX}  ${cY}`;
            }
        }

        public static GetSeparatorDownPath(cX: number, cY: number, startX: number, height: number, base: number): string {
            if (Visual.flag === 0) {
                return `M  ${cX}  ${cY} L ${startX + base}  ${cY + height}`;
            } else {
                return `M  ${cX}  ${cY} L ${cX + height}  ${startX + base}`;
            }
        }

        /**
         * This function gets called for each of the objects defined in the capabilities files and allows you to select which of the
         * objects and properties you want to expose to the users in the property pane.
         *
         */
        public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions):
            VisualObjectInstance[] | VisualObjectInstanceEnumerationObject {
            const objectName: string = options.objectName;
            const objectEnumeration: VisualObjectInstance[] = [];
            const categoryLabelSetting: ICategoryLabelSettings = Visual.categoryLabelSettings;
            const separatorSetting: ISeparatorSettings = Visual.separatorSettings;
            const conversionSetting: IConversionSettings = Visual.conversionSettings;
            const detailLabelSetting: IDetailLabelSettings = Visual.detailLabelSettings;
            const rotationSetting: IRotationSettings = this.rotationSettings;
            const gradientSettings: IGradientSettings = Visual.gradientSettings;
            const animationSettings: IAnimationSettings = this.animationSettings;
            const orientationSettings: IOrientationSettings = this.orientationSettings;
            const legendConfig: ILegendConfig = this.legendSetting;
            switch (objectName) {
                case 'colorSettings':
                    enumerateColorSetting(this.visualModel, objectEnumeration, objectName);

                    return objectEnumeration;
                case 'categoryLabelSettings':
                    enumerateCategoryLabelSetting(categoryLabelSetting, objectEnumeration, objectName);

                    return objectEnumeration;
                case 'separatorSettings':
                    enumerateSeparatorSetting(separatorSetting, objectEnumeration, objectName);

                    return objectEnumeration;
                case 'conversionSettings':
                    enumerateConversionSetting(conversionSetting, objectEnumeration, objectName);

                    return objectEnumeration;
                case 'detailLabelSettings':

                    enumerateDetailLabelSetting(detailLabelSetting, objectEnumeration, objectName);

                    return objectEnumeration;
                case 'rotationSettings':
                    enumerateRotationSetting(rotationSetting, objectEnumeration, objectName);

                    return objectEnumeration;

                case 'animationSettings':
                    enumerateAnimationSetting(animationSettings, objectEnumeration, objectName);

                    return objectEnumeration;

                case 'orientationSettings':
                    enumerateOrientationSetting(orientationSettings, objectEnumeration, objectName);

                    return objectEnumeration;

                case 'legend':
                    enumerateLegend(legendConfig, objectEnumeration, objectName);

                    return objectEnumeration;

                case 'gradientSettings':
                    enumerateRotationSetting(gradientSettings, objectEnumeration, objectName);

                    return objectEnumeration;

                default:
                    return objectEnumeration;
            }
        }

        // tslint:disable-next-line:no-any
        private getTooltipData(value: any): VisualTooltipDataItem[] {
            let tooltipDataPointsFinal: VisualTooltipDataItem[];
            tooltipDataPointsFinal = [];
            let tooltipDataPoints: ITooltipDataPoints[];
            tooltipDataPoints = value.tooltipData;
            let tooltipDataSize: number;
            tooltipDataSize = tooltipDataPoints.length;
            let i: number = 0;
            for (; i < tooltipDataSize; i++) {
                let tooltipData: VisualTooltipDataItem;
                tooltipData = {
                    displayName: '',
                    value: ''
                };
                tooltipData.displayName = tooltipDataPoints[i].name;
                let formattingString: string;
                formattingString = tooltipDataPoints[i].formatter
                    ? tooltipDataPoints[i].formatter : ValueFormatter.DefaultNumericFormat;
                let formatter: IValueFormatter;
                formatter = ValueFormatter.create({
                    format: formattingString
                });
                if (isNaN(parseFloat(tooltipDataPoints[i].value))) {
                    tooltipData.value = (tooltipDataPoints[i].value === '' ? '(Blank)' : tooltipDataPoints[i].value);
                } else {
                    tooltipData.value = formatter.format(parseFloat(tooltipDataPoints[i].value));
                }
                tooltipDataPointsFinal.push(tooltipData);
            }

            return tooltipDataPointsFinal;
        }

        // tslint:disable-next-line:no-any
        private getTooltipDataForConversion(value: any, categoryName: string, conversionlabel: any): VisualTooltipDataItem[] {
            // tslint:disable-next-line:no-any
            const val: any = value.source === 0 ? 0 :
                (Math.round(value.destination / value.source * 100)).toString() + Visual.percentageLiteral;

            return [{
                displayName: categoryName,
                value: value.category.toString()
            },
            {
                displayName: conversionlabel,
                value: val
            }];
        }
        public renderLegend(dataViews: DataView, legendConfig: ILegendConfig, isScrollPresent: boolean): void {
            if (!Visual.legendDataPoints && Visual.legendDataPoints.length && !legendConfig.show) { return; }
            const sTitle: string = '';
            let legendObjectProperties: DataViewObject;
            if (dataViews && dataViews.metadata) {
                legendObjectProperties = powerbi
                    .extensibility
                    .utils
                    .dataview
                    .DataViewObjects
                    .getObject(dataViews.metadata.objects, 'legend', {});
            }

            let legendData: ILegendDataPoint[];
            legendData = Visual.legendDataPoints;
            const legendDataTorender: utils.chart.legend.LegendData = {
                dataPoints: [],
                fontSize: legendConfig.fontSize,
                labelColor: legendConfig.labelColor,
                title: Visual.legendTitle
            };
            for (const iCounter of legendData) {
                legendDataTorender.dataPoints.push({
                    color: iCounter.color,
                    icon: powerbi.extensibility.utils.chart.legend.LegendIcon.Circle,
                    identity: iCounter.identity,
                    label: iCounter.category,
                    selected: iCounter.selected
                });
            }
            if (legendObjectProperties) {
                powerbi.extensibility.utils.chart.legend.data.update(legendDataTorender, legendObjectProperties);
                const position: string = <string>legendObjectProperties[powerbi.extensibility.utils.chart.legend.legendProps.position];
                if (position) { Visual.legend.changeOrientation(powerbi.extensibility.utils.chart.legend.LegendPosition[position]); }

            }

            Visual.legend.drawLegend(
                legendDataTorender,
                ({ width: this.viewport.width, height: this.viewport.height })
            );
        }
    }
}
