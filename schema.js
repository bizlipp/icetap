/**
 * DataStackULTRA Schema Module
 * Provides schema validation capabilities
 */

(function(global) {
  'use strict';

  /**
   * Abstract SchemaValidator interface
   * All validator implementations must implement these methods
   */
  class SchemaValidator {
    /**
     * Validate data against a schema
     * @param {Object} data - Data to validate
     * @param {Object} schema - Schema to validate against
     * @param {Object} options - Validation options
     * @returns {Object} - Validation result with isValid and errors
     */
    validate(data, schema, options = {}) {
      throw new Error('Method not implemented');
    }
    
    /**
     * Register a custom schema
     * @param {string} name - Schema name
     * @param {Object} schema - Schema definition
     * @returns {boolean} - Success status
     */
    registerSchema(name, schema) {
      throw new Error('Method not implemented');
    }
    
    /**
     * Get a registered schema
     * @param {string} name - Schema name
     * @returns {Object|null} - Schema definition or null if not found
     */
    getSchema(name) {
      throw new Error('Method not implemented');
    }
  }

  /**
   * Simple validator implementation
   */
  class SimpleValidator extends SchemaValidator {
    /**
     * Create a new SimpleValidator
     * @param {Object} options - Validator options
     */
    constructor(options = {}) {
      super();
      this.schemas = new Map();
      this.strictMode = options.strictMode !== false;
      this.coercionEnabled = options.coercionEnabled === true;
    }
    
    /**
     * Validate data against a schema
     * @param {Object} data - Data to validate
     * @param {Object|string} schema - Schema to validate against (or schema name)
     * @param {Object} options - Validation options
     * @returns {Object} - Validation result with isValid and errors
     */
    validate(data, schema, options = {}) {
      // If schema is a string, look it up by name
      if (typeof schema === 'string') {
        const namedSchema = this.getSchema(schema);
        if (!namedSchema) {
          return {
            isValid: false,
            errors: [`Schema '${schema}' not found`]
          };
        }
        schema = namedSchema;
      }
      
      const result = {
        isValid: true,
        errors: [],
        validatedData: this.coercionEnabled ? {} : null
      };
      
      // Check if data is the correct type
      if (schema.type) {
        const dataType = this._getType(data);
        
        if (dataType !== schema.type) {
          if (this.coercionEnabled) {
            // Try to coerce the value
            const coercedValue = this._coerceValue(data, schema.type);
            if (coercedValue !== undefined && !(typeof coercedValue === 'number' && isNaN(coercedValue))) { // Check for NaN specifically for numbers
              data = coercedValue;
            } else {
              result.isValid = false;
              result.errors.push(`Expected type '${schema.type}', got '${dataType}' (coercion failed or resulted in NaN)`);
              // If coercion fails, no need to proceed with this branch
              if (schema.type === 'object' || schema.type === 'array') return result;
            }
          } else {
            result.isValid = false;
            result.errors.push(`Expected type '${schema.type}', got '${dataType}'`);
            // If type is wrong and no coercion, no need to proceed for object/array
            if (schema.type === 'object' || schema.type === 'array') return result;
          }
        }
      }
      
      if (!result.isValid && (schema.type === 'object' || schema.type === 'array')) {
          // If initial type validation failed for object/array, don't proceed to property/item validation
          return result;
      }

      // If it's an object schema, validate properties
      if (schema.type === 'object' && schema.properties) {
        // Initialize validatedData for object type if coercion is enabled
        if (this.coercionEnabled && result.validatedData === null) { // Ensure it's only initialized once
          result.validatedData = {};
        }
        
        // Check required properties
        if (schema.required && Array.isArray(schema.required)) {
          for (const requiredProp of schema.required) {
            if (data[requiredProp] === undefined) {
              result.isValid = false;
              result.errors.push(`Missing required property: ${requiredProp}`);
            }
          }
        }
        
        // Check each property
        for (const [propName, propSchema] of Object.entries(schema.properties)) {
          if (data[propName] !== undefined) {
            const propResult = this.validate(data[propName], propSchema, options);
            
            if (!propResult.isValid) {
              result.isValid = false;
              
              // Add property path to error messages
              propResult.errors.forEach(error => {
                result.errors.push(`${propName}: ${error}`);
              });
            }
            
            if (this.coercionEnabled && result.validatedData) { // Check if result.validatedData exists
              result.validatedData[propName] = propResult.validatedData !== null ?
                propResult.validatedData :
                data[propName];
            }
          } else if (this.coercionEnabled && result.validatedData) { // Check if result.validatedData exists
            // Use default value if available
            if (propSchema.default !== undefined) {
              result.validatedData[propName] = propSchema.default;
            }
          }
        }
        
        // In strict mode, check for extra properties
        if (this.strictMode && !schema.additionalProperties) {
          const schemaProps = new Set(Object.keys(schema.properties));
          
          for (const propName of Object.keys(data)) {
            if (!schemaProps.has(propName)) {
              result.isValid = false;
              result.errors.push(`Unknown property: ${propName}`);
            }
          }
        }
      } else if (schema.type === 'array' && schema.items) {
        // If it's an array schema, validate items
        if (!Array.isArray(data)) {
          result.isValid = false;
          result.errors.push(`Expected array, got ${this._getType(data)}`);
          return result;
        }
        
        if (this.coercionEnabled && result.validatedData === null) {
            result.validatedData = [];
        }
        
        // Validate each item in the array
        for (let i = 0; i < data.length; i++) {
          const itemResult = this.validate(data[i], schema.items, options);
          
          if (!itemResult.isValid) {
            result.isValid = false;
            
            // Add array index to error messages
            itemResult.errors.forEach(error => {
              result.errors.push(`[${i}]: ${error}`);
            });
          }
          
          // Store validated/coerced value if coercion is enabled
          if (this.coercionEnabled && result.validatedData) { // Ensure validatedData is not null
            result.validatedData.push(itemResult.validatedData !== null ?
              itemResult.validatedData :
              data[i]);
          }
        }
        
        // Check min/max items
        if (schema.minItems !== undefined && data.length < schema.minItems) {
          result.isValid = false;
          result.errors.push(`Array must have at least ${schema.minItems} items, got ${data.length}`);
        }
        
        if (schema.maxItems !== undefined && data.length > schema.maxItems) {
          result.isValid = false;
          result.errors.push(`Array must have at most ${schema.maxItems} items, got ${data.length}`);
        }
      } else if (schema.type === 'string') {
        // String-specific validations
        if (typeof data !== 'string') {
          if (this.coercionEnabled) {
            data = String(data);
          } else {
            result.isValid = false;
            result.errors.push(`Expected string, got ${this._getType(data)}`);
          }
        }
        
        // Store validated/coerced value if coercion is enabled
        if (this.coercionEnabled && result.isValid) { // only set if still valid
            result.validatedData = data;
        }
        
        // Check pattern
        if (schema.pattern && !new RegExp(schema.pattern).test(data)) {
          result.isValid = false;
          result.errors.push(`String does not match pattern: ${schema.pattern}`);
        }
        
        // Check min/max length
        if (schema.minLength !== undefined && data.length < schema.minLength) {
          result.isValid = false;
          result.errors.push(`String must be at least ${schema.minLength} characters, got ${data.length}`);
        }
        
        if (schema.maxLength !== undefined && data.length > schema.maxLength) {
          result.isValid = false;
          result.errors.push(`String must be at most ${schema.maxLength} characters, got ${data.length}`);
        }
      } else if (schema.type === 'number' || schema.type === 'integer') {
        // Number-specific validations
        if (typeof data !== 'number') {
          if (this.coercionEnabled) {
            const originalData = data; // Store original for error message
            data = Number(data);
            if (isNaN(data)) {
              result.isValid = false;
              result.errors.push(`Cannot coerce '${originalData}' to number.`);
            }
          } else {
            result.isValid = false;
            result.errors.push(`Expected number, got ${this._getType(data)}`);
          }
        }
        
        // Store validated/coerced value if coercion is enabled
        if (this.coercionEnabled && result.isValid) { // only set if still valid
            result.validatedData = data;
        }
        
        // Check integer
        if (schema.type === 'integer' && !Number.isInteger(data)) {
          result.isValid = false;
          result.errors.push(`Expected integer, got ${data}`);
        }
        
        // Check min/max
        if (schema.minimum !== undefined && data < schema.minimum) {
          result.isValid = false;
          result.errors.push(`Number must be at least ${schema.minimum}, got ${data}`);
        }
        
        if (schema.maximum !== undefined && data > schema.maximum) {
          result.isValid = false;
          result.errors.push(`Number must be at most ${schema.maximum}, got ${data}`);
        }
      } else if (schema.type === 'boolean') {
        // Boolean-specific validations
        if (typeof data !== 'boolean') {
          if (this.coercionEnabled) {
            if (String(data).toLowerCase() === 'true') data = true;
            else if (String(data).toLowerCase() === 'false') data = false;
            else {
              result.isValid = false;
              result.errors.push(`Cannot coerce '${data}' to boolean.`);
            }
          } else {
            result.isValid = false;
            result.errors.push(`Expected boolean, got ${this._getType(data)}`);
          }
        }
        
        // Store validated/coerced value if coercion is enabled
        if (this.coercionEnabled && result.isValid) { // only set if still valid
             result.validatedData = data;
        }
      } else if (schema.enum && Array.isArray(schema.enum)) {
        // Enum validation
        if (!schema.enum.includes(data)) {
          result.isValid = false;
          result.errors.push(`Value must be one of: ${schema.enum.join(', ')}`);
        }
        
        // Store validated value if coercion is enabled
        if (this.coercionEnabled && result.isValid) {
          result.validatedData = data;
        }
      }
      
      // If coercion is enabled but no specific type logic handled validatedData, set it to data
      if (this.coercionEnabled && result.validatedData === null && schema.type && !['object', 'array'].includes(schema.type)) {
        if (result.isValid) { // Only assign if data is considered valid at this point
            result.validatedData = data;
        }
      }
      // If coercion is not enabled, result.validatedData remains null as initialized.
      
      return result;
    }
    
    /**
     * Get the type of a value
     * @private
     * @param {*} value - Value to check
     * @returns {string} - Type of the value
     */
    _getType(value) {
      if (value === null) return 'null';
      if (Array.isArray(value)) return 'array';
      return typeof value;
    }
    
    /**
     * Try to coerce a value to a specific type
     * @private
     * @param {*} value - Value to coerce
     * @param {string} type - Type to coerce to
     * @returns {*} - Coerced value or undefined if coercion failed
     */
    _coerceValue(value, type) {
      if (type === 'string') return String(value);
      if (type === 'number') {
          const num = Number(value);
          return isNaN(num) ? undefined : num;
      }
      if (type === 'integer') {
          const int = parseInt(value, 10);
          return isNaN(int) ? undefined : int;
      }
      if (type === 'boolean') {
        if (String(value).toLowerCase() === 'true') return true;
        if (String(value).toLowerCase() === 'false') return false;
        return undefined;
      }
      // Add other coercions as needed (e.g., date)
      return undefined; // Cannot coerce
    }
    
    /**
     * Register a custom schema
     * @param {string} name - Schema name
     * @param {Object} schema - Schema definition
     * @returns {boolean} - Success status
     */
    registerSchema(name, schema) {
      if (this.schemas.has(name)) {
        console.warn(`Schema \'${name}\' already registered. Overwriting.`);
      }
      this.schemas.set(name, schema);
      return true;
    }
    
    /**
     * Get a registered schema
     * @param {string} name - Schema name
     * @returns {Object|null} - Schema definition or null if not found
     */
    getSchema(name) {
      return this.schemas.get(name) || null;
    }
  }

  /**
   * Create a schema validator factory
   */
  class SchemaFactory {
    /**
     * Create a schema validator based on strategy
     * @param {string} strategy - Validation strategy
     * @param {Object} options - Validator options
     * @returns {SchemaValidator} - Schema validator instance
     */
    static createValidator(strategy, options = {}) {
      // Allow config to be passed via options directly for flexibility
      const config = options.config || (global.DataStackULTRA && global.DataStackULTRA.config ? global.DataStackULTRA.config.schema : {}) || {};
      const effectiveOptions = { ...config, ...options }; // options can override global config

      switch (strategy) {
        case 'simple':
          return new SimpleValidator(effectiveOptions);
        case 'ajv':
          // Example for a more complex validator
          console.warn('Ajv validation not implemented, using simple validator');
          return new SimpleValidator(effectiveOptions);
        case 'zod':
          // Example for a more complex validator
          console.warn('Zod validation not implemented, using simple validator');
          return new SimpleValidator(effectiveOptions);
        case 'yup':
          // Example for a more complex validator
          console.warn('Yup validation not implemented, using simple validator');
          return new SimpleValidator(effectiveOptions);
        case 'custom':
          if (!options.implementation) {
            throw new Error('Custom validator requires an implementation');
          }
          return options.implementation;
        default:
          console.warn(`Unknown validation strategy: ${strategy}. Defaulting to SimpleValidator.`);
          return new SimpleValidator(effectiveOptions);
      }
    }
  }

  /**
   * Main schema manager for validation
   */
  class SchemaManager {
    /**
     * Create a new SchemaManager
     * @param {Object} options - Configuration options
     */
    constructor(options = {}) {
      // Use provided config or fallback to global DEFAULT_CONFIG.schema if available.
      // This change makes SchemaManager less dependent on createConfig being directly available
      // or DataStackULTRA being fully initialized with its config.
      const schemaConfig = options.config || (global.DEFAULT_CONFIG ? global.DEFAULT_CONFIG.schema : {});
      
      this.config = {
        enabled: schemaConfig.enabled !== undefined ? schemaConfig.enabled : true,
        defaultStrategy: schemaConfig.defaultStrategy || 'simple',
        strictMode: schemaConfig.strictMode !== undefined ? schemaConfig.strictMode : true,
        coercionEnabled: schemaConfig.coercionEnabled !== undefined ? schemaConfig.coercionEnabled : false,
        // Add other relevant schema options here from config if necessary
        ...options // Allow direct options to override defaults or config
      };

      this.validator = SchemaFactory.createValidator(this.config.defaultStrategy, this.config);
      this.commonSchemasRegistered = false;

      if (this.config.enabled && !this.commonSchemasRegistered) {
        this.registerCommonSchemas();
      }
    }
    
    /**
     * Check if validation is enabled
     * @returns {boolean} - Whether validation is enabled
     */
    isEnabled() {
      return this.config.enabled;
    }
    
    /**
     * Validate data against a schema
     * @param {Object} data - Data to validate
     * @param {Object|string} schema - Schema to validate against (or schema name)
     * @param {Object} options - Validation options
     * @returns {Object} - Validation result with isValid and errors
     */
    validate(data, schema, options = {}) {
      if (!this.isEnabled()) {
        return { isValid: true, errors: [], validatedData: this.config.coercionEnabled ? data : null };
      }
      const effectiveOptions = { 
        strictMode: this.config.strictMode, 
        coercionEnabled: this.config.coercionEnabled,
        ...options 
      };
      return this.validator.validate(data, schema, effectiveOptions);
    }
    
    /**
     * Register a custom schema
     * @param {string} name - Schema name
     * @param {Object} schema - Schema definition
     * @returns {boolean} - Success status
     */
    registerSchema(name, schema) {
      if (!this.isEnabled()) return false;
      return this.validator.registerSchema(name, schema);
    }
    
    /**
     * Get a registered schema
     * @param {string} name - Schema name
     * @returns {Object|null} - Schema definition or null if not found
     */
    getSchema(name) {
      if (!this.isEnabled()) return null;
      return this.validator.getSchema(name);
    }
    
    /**
     * Register common schema patterns
     * @returns {Object} - Registered schemas
     */
    registerCommonSchemas() {
      if (!this.isEnabled()) {
        return {};
      }
      
      const schemas = {
        email: {
          type: 'string',
          pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'
        },
        uuid: {
          type: 'string',
          pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        },
        url: {
          type: 'string',
          pattern: '^(https?|ftp)://[^\\s/$.?#].[^\\s]*$'
        },
        date: {
          type: 'string',
          pattern: '^\\d{4}-\\d{2}-\\d{2}$'
        },
        datetime: {
          type: 'string',
          pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d{1,3})?(Z|[+-]\\d{2}:\\d{2})$'
        }
      };
      
      for (const [name, schema] of Object.entries(schemas)) {
        this.registerSchema(name, schema);
      }
      
      // Example: Basic call object schema
      this.registerSchema('callObject', {
        type: 'object',
        properties: {
          contactId: { type: 'string', pattern: '^[a-f0-9\\-]+$' }, // Basic UUID-like pattern
          timestamp: { type: 'string', format: 'date-time' }, // Assuming ISO 8601
          agentId: { type: 'string' },
          customerId: { type: 'string' },
          duration: { type: 'number', minimum: 0 }, // in seconds
          transcript: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                speaker: { type: 'string', enum: ['agent', 'customer', 'system'] },
                timestamp: { type: 'string' }, // Could be relative time e.g., "00:05:23"
                text: { type: 'string' }
              },
              required: ['speaker', 'timestamp', 'text']
            }
          },
          metadata: { type: 'object' } // Could be further defined
        },
        required: ['contactId', 'timestamp', 'transcript']
      });

      // Example: User profile schema
      this.registerSchema('userProfile', {
        type: 'object',
        properties: {
          userId: { type: 'string' },
          username: { type: 'string', minLength: 3 },
          email: { type: 'string', format: 'email' },
          roles: { type: 'array', items: { type: 'string' } }
        },
        required: ['userId', 'username', 'email']
      });
      this.commonSchemasRegistered = true;
      console.log("DataStackULTRA: Common schemas registered.");
    }
    
    /**
     * Get the validator instance
     * @returns {SchemaValidator|null} - Schema validator instance
     */
    getValidator() {
      return this.validator;
    }
  }

  // Expose to the global object (window in browsers)
  global.SchemaValidator = SchemaValidator;
  global.SimpleValidator = SimpleValidator;
  global.SchemaFactory = SchemaFactory;
  global.SchemaManager = SchemaManager;

})(typeof window !== 'undefined' ? window : this); 