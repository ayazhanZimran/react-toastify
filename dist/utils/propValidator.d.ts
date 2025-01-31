import { Id } from '../types';
export declare function isNum(v: any): v is Number;
export declare function isBool(v: any): v is Boolean;
export declare function isStr(v: any): v is String;
export declare function isFn(v: any): v is Function;
export declare function parseClassName(v: any): any;
export declare function isToastIdValid(toastId?: Id): boolean;
export declare function getAutoCloseDelay(toastAutoClose?: false | number, containerAutoClose?: false | number): number | false | undefined;
export declare function canBeRendered<T>(content: T): boolean;
