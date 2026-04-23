import { Request, Response, NextFunction } from 'express';
import { JoinUsService, JoinUsFilters } from '../services/joinUs.service';
import { parsePaginationParams } from '../types/pagination';
import { ServiceType } from '../entities/Transaction';

export class JoinUsController {
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const joinUs = await JoinUsService.create(req.body);

      res.status(201).json({
        status: 201,
        message: 'JoinUs record created successfully',
        data: joinUs,
      });
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const joinUs = await JoinUsService.update(id, req.body);

      res.json({
        status: 200,
        message: 'JoinUs record updated successfully',
        data: joinUs,
      });
    } catch (error) {
      next(error);
    }
  }

  static async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const joinUs = await JoinUsService.findById(id);

      res.json({
        status: 200,
        data: joinUs,
      });
    } catch (error) {
      next(error);
    }
  }

  static async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      const filters: JoinUsFilters = {
        name: req.query.name as string,
        phone: req.query.phone as string,
        engineeringType: req.query.engineeringType as ServiceType,
      };

      const pagination = parsePaginationParams(req.query);
      const result = await JoinUsService.findAll(filters, pagination);

      res.json({
        status: 200,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await JoinUsService.delete(id);

      res.json({
        status: 200,
        message: 'JoinUs record deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}
