/**
 * DataStackULTRA Transform Module
 * Provides data transformation capabilities
 */

(function(global) {
  'use strict';

  // createConfig and DEFAULT_CONFIG are expected on the global object (e.g. global.createConfig)

  /**
   * Abstract Transformer interface
   * All transformer implementations must implement these methods
   */
  class Transformer {
    /**
     * Serialize data to a string
     * @param {*} data - Data to serialize
     * @param {Object} options - Serialization options
     * @returns {string} - Serialized data
     */
    serialize(data, options = {}) {
      throw new Error('Method not implemented');
    }
    
    /**
     * Deserialize string to data
     * @param {string} serialized - Serialized data
     * @param {Object} options - Deserialization options
     * @returns {*} - Deserialized data
     */
    deserialize(serialized, options = {}) {
      throw new Error('Method not implemented');
    }
    
    /**
     * Transform data from one format to another
     * @param {*} data - Data to transform
     * @param {Object} transformConfig - Transformation configuration
     * @returns {*} - Transformed data
     */
    transform(data, transformConfig = {}) {
      throw new Error('Method not implemented');
    }
  }

  /**
   * JSON Transformer implementation
   */
  class JSONTransformer extends Transformer {
    /**
     * Create a new JSONTransformer
     * @param {Object} options - Transformer options
     */
    constructor(options = {}) {
      super();
      this.compactOutput = options.compactOutput !== false;
      this.reviver = options.reviver || null;
      this.replacer = options.replacer || null;
    }
    
    /**
     * Serialize data to a JSON string
     * @param {*} data - Data to serialize
     * @param {Object} options - Serialization options
     * @returns {string} - Serialized data
     */
    serialize(data, options = {}) {
      try {
        const space = (options.compact !== undefined ? options.compact : this.compactOutput) ? undefined : 2;
        const replacer = options.replacer || this.replacer;
        
        return JSON.stringify(data, replacer, space);
      } catch (error) {
        console.error('Failed to serialize data to JSON:', error);
        throw new Error(`Serialization error: ${error.message}`);
      }
    }
    
    /**
     * Deserialize JSON string to data
     * @param {string} serialized - Serialized data
     * @param {Object} options - Deserialization options
     * @returns {*} - Deserialized data
     */
    deserialize(serialized, options = {}) {
      try {
        const reviver = options.reviver || this.reviver;
        
        return JSON.parse(serialized, reviver);
      } catch (error) {
        console.error('Failed to deserialize JSON data:', error);
        throw new Error(`Deserialization error: ${error.message}`);
      }
    }
    
    /**
     * Transform data using specified operations
     * @param {*} data - Data to transform
     * @param {Object} transformConfig - Transformation configuration
     * @returns {*} - Transformed data
     */
    transform(data, transformConfig = {}) {
      // Simple implementation that allows renaming and filtering fields
      if (!data || typeof data !== 'object') {
        return data;
      }
      
      const result = Array.isArray(data) ? [] : {};
      
      // If data is an array, apply transformation to each item
      if (Array.isArray(data)) {
        return data.map(item => this.transform(item, transformConfig));
      }
      
      // Apply field renames and transformations
      const { rename, include, exclude, transform } = transformConfig;
      
      // First, determine which fields to include
      let fieldsToInclude;
      
      if (include && Array.isArray(include) && include.length > 0) {
        // Only include specified fields
        fieldsToInclude = new Set(include);
      } else if (exclude && Array.isArray(exclude) && exclude.length > 0) {
        // Include all fields except excluded ones
        fieldsToInclude = new Set(
          Object.keys(data).filter(key => !exclude.includes(key))
        );
      } else {
        // Include all fields
        fieldsToInclude = new Set(Object.keys(data));
      }
      
      // Process each field
      for (const [key, value] of Object.entries(data)) {
        // Skip if field should not be included
        if (!fieldsToInclude.has(key)) {
          continue;
        }
        
        // Get the target key (renamed or original)
        const targetKey = rename && rename[key] ? rename[key] : key;
        
        // Transform value if a transformer is specified
        const fieldTransform = transform && transform[key];
        const transformedValue = fieldTransform 
          ? (typeof fieldTransform === 'function' 
            ? fieldTransform(value, data) 
            : value) 
          : value;
        
        // Add to result
        result[targetKey] = transformedValue;
      }
      
      return result;
    }
  }

  /**
   * Transformer factory to create transformer instances based on configuration
   */
  class TransformerFactory {
    /**
     * Create a transformer instance based on format
     * @param {string} format - Serialization format
     * @param {Object} options - Transformer options
     * @returns {Transformer} - Transformer instance
     */
    static createTransformer(format, options = {}) {
      switch (format) {
        case 'json':
          return new JSONTransformer(options);
        case 'bson':
          // In a real implementation, this would use a BSON library
          console.warn('BSON format not implemented, using JSON');
          return new JSONTransformer(options);
        case 'protobuf':
          // In a real implementation, this would use Protocol Buffers
          console.warn('Protocol Buffers format not implemented, using JSON');
          return new JSONTransformer(options);
        case 'custom':
          if (!options.implementation) {
            throw new Error('Custom transformer requires an implementation');
          }
          return options.implementation;
        default:
          console.warn(`Invalid format: ${format}, using JSON`);
          return new JSONTransformer(options);
      }
    }
  }

  /**
   * Main transform manager for serialization and transformations
   */
  class TransformManager {
    /**
     * Create a new TransformManager
     * @param {Object} options - Configuration options
     */
    constructor(options = {}) {
      // Access global.DEFAULT_CONFIG safely
      const globalDefaultConfig = (global.DEFAULT_CONFIG && global.DEFAULT_CONFIG.transform) ? global.DEFAULT_CONFIG.transform : {};
      const transformConfig = options.transform || globalDefaultConfig;
      
      this.config = {
        autoSerialize: transformConfig.autoSerialize !== undefined ? transformConfig.autoSerialize : true,
        serializationFormat: transformConfig.serializationFormat || 'json',
        compactOutput: transformConfig.compactOutput !== undefined ? transformConfig.compactOutput : true,
        pipelines: {},
        ...(options.config && options.config.transform ? options.config.transform : {}), // Merge options.config.transform if present
        ...options // Direct options override everything (last spread)
      };
      // Ensure pipelines from options.config.transform or options.pipelines are merged if they exist
      if(options.pipelines) this.config.pipelines = {...this.config.pipelines, ...options.pipelines};
      if(options.config && options.config.transform && options.config.transform.pipelines) this.config.pipelines = {...this.config.pipelines, ...options.config.transform.pipelines};

      // Create transformer
      this.transformer = TransformerFactory.createTransformer(
        this.config.serializationFormat,
        {
          compactOutput: this.config.compactOutput
        }
      );
    }
    
    /**
     * Serialize data to a string
     * @param {*} data - Data to serialize
     * @param {Object} options - Serialization options
     * @returns {string} - Serialized data
     */
    serialize(data, options = {}) {
      return this.transformer.serialize(data, options);
    }
    
    /**
     * Deserialize string to data
     * @param {string} serialized - Serialized data
     * @param {Object} options - Deserialization options
     * @returns {*} - Deserialized data
     */
    deserialize(serialized, options = {}) {
      return this.transformer.deserialize(serialized, options);
    }
    
    /**
     * Transform data using a specific transformation config
     * @param {*} data - Data to transform
     * @param {Object|string} transformConfig - Transformation configuration or pipeline name
     * @returns {*} - Transformed data
     */
    transform(data, pipelineNameOrDefinition) {
      let pipeline = [];
      if (typeof pipelineNameOrDefinition === 'string') {
        pipeline = this.config.pipelines[pipelineNameOrDefinition] || [];
        if (pipeline.length === 0) {
            console.warn(`Transform pipeline "${pipelineNameOrDefinition}" not found or is empty.`);
            return data; // Return data unchanged if pipeline not found
        }
      } else if (Array.isArray(pipelineNameOrDefinition)) {
        pipeline = pipelineNameOrDefinition;
      } else if (typeof pipelineNameOrDefinition === 'object' && pipelineNameOrDefinition !== null) {
        // Assume it's a single transform object for ad-hoc transformation
        pipeline = [pipelineNameOrDefinition];
      } else {
        console.warn('Invalid transform pipeline provided. Must be a name, array, or object.');
        return data;
      }

      let result = data;
      try {
          for (const step of pipeline) {
              if (typeof step.type !== 'string') {
                  console.warn("Skipping invalid transform step: type is missing or not a string", step);
                  continue;
              }
              const processor = this._getProcessor(step.type);
              if (processor) {
                  result = processor(result, step.options || {});
              } else {
                  console.warn(`Unknown transform type: ${step.type}`);
              }
          }
      } catch (error) {
          console.error("Error during transformation pipeline:", error, "Pipeline:", pipeline, "Data:", data);
          // Optionally re-throw or return original data / specific error state
          return data; // Fallback to original data on error
      }
      return result;
    }
    
    /**
     * Register a transformation pipeline
     * @param {string} name - Pipeline name
     * @param {Array|Object} pipeline - Transformation pipeline or config
     * @returns {boolean} - Success status
     */
    registerPipeline(name, pipeline) {
      if (typeof name !== 'string' || !name) {
        console.error('Pipeline name must be a non-empty string.');
        return false;
      }
      if (!Array.isArray(pipeline) || pipeline.length === 0) {
        console.error('Pipeline must be a non-empty array of transform steps.');
        return false;
      }
      // Basic validation of pipeline steps (can be more thorough)
      for (const step of pipeline) {
        if (typeof step !== 'object' || step === null || typeof step.type !== 'string') {
          console.error('Invalid step in pipeline: Each step must be an object with a "type" string property.', step);
          return false;
        }
      }
      this.config.pipelines[name] = pipeline;
      // console.log(`Transform pipeline "${name}" registered:`, pipeline);
      return true;
    }
    
    /**
     * Apply a transformation pipeline to data
     * @private
     * @param {*} data - Data to transform
     * @param {Array} pipeline - Transformation pipeline
     * @returns {*} - Transformed data
     */
    _applyPipeline(data, pipeline) {
      return pipeline.reduce((result, config) => {
        return this.transformer.transform(result, config);
      }, data);
    }
    
    /**
     * Clone data by serializing and deserializing it
     * @param {*} data - Data to clone
     * @returns {*} - Cloned data
     */
    clone(data) {
      const serialized = this.serialize(data);
      return this.deserialize(serialized);
    }
    
    /**
     * Create a data mapper for a specific schema
     * @param {Object} schema - Schema to map to
     * @returns {Function} - Mapper function
     */
    createMapper(schema) {
      // This is a placeholder. A real mapper would inspect the schema
      // and create optimized transformation functions based on it.
      // For now, it just returns a generic transform function.
      // console.log("createMapper called with schema (placeholder implementation):", schema);
      return (data, pipelineNameOrDefinition) => this.transform(data, pipelineNameOrDefinition);
    }
    
    /**
     * Get the transformer instance
     * @returns {Transformer} - Transformer instance
     */
    getTransformer() {
      return this.transformer;
    }

    _getProcessor(type) {
      // Example processors (extend with more)
      switch (type.toLowerCase()) {
        case 'serialize':
          return (data, options) => this._serialize(data, options.format || this.config.serializationFormat);
        case 'deserialize':
          return (data, options) => this._deserialize(data, options.format || this.config.serializationFormat);
        case 'toUpperCase':
          return (data) => typeof data === 'string' ? data.toUpperCase() : data;
        case 'toLowerCase':
          return (data) => typeof data === 'string' ? data.toLowerCase() : data;
        case 'trim':
          return (data) => typeof data === 'string' ? data.trim() : data;
        case 'pick': // Picks specified properties from an object
          return (data, options) => {
            if (typeof data !== 'object' || data === null || !Array.isArray(options.fields)) return data;
            return options.fields.reduce((obj, field) => {
              if (data.hasOwnProperty(field)) obj[field] = data[field];
              return obj;
            }, {});
          };
        case 'omit': // Omits specified properties from an object
           return (data, options) => {
            if (typeof data !== 'object' || data === null || !Array.isArray(options.fields)) return data;
            const newData = { ...data };
            options.fields.forEach(field => delete newData[field]);
            return newData;
          };
        // Add more processors like: filter, map, reduce, customFunction, etc.
        default:
          return null;
      }
    }

    _serialize(data, format) {
      if (format === 'json') {
        try {
          return JSON.stringify(data, null, this.config.compactOutput ? 0 : 2);
        } catch (e) { console.error("JSON Serialization failed:", e); return String(data); }
      }
      // Add other formats like BSON, Protobuf here
      console.warn(`Unsupported serialization format: ${format}. Returning raw data.`);
      return data;
    }

    _deserialize(data, format) {
      if (format === 'json' && typeof data === 'string') {
        try {
          return JSON.parse(data);
        } catch (e) { 
            // console.warn("JSON Deserialization failed, returning raw data:", e, "Data:", data);
            return data; // If it's not valid JSON, return as is
        }
      }
      // Add other formats here
      // console.warn(`Unsupported deserialization format: ${format} or data is not a string. Returning raw data.`);
      return data;
    }
  }

  // Expose necessary classes to the global object
  global.Transformer = Transformer; // Base class, might be useful
  global.JSONTransformer = JSONTransformer; // Specific implementation
  global.TransformerFactory = TransformerFactory;
  global.TransformManager = TransformManager;

})(typeof window !== 'undefined' ? window : this); 